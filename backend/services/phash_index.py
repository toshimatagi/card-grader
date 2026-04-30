"""カードpHashの軽量インメモリインデックス。
- Supabase から (card_id, set_code, card_no, variant, rarity, name_ja, image_url, image_phash) を
  一括取得してメモリにキャッシュ
- nearest(query) で64bitハミング距離による線形探索 → top K
- 3000件規模なら数msで終わる
- TTL: REFRESH_SEC で自動リロード
"""

from __future__ import annotations

import asyncio
import os
import time
from base64 import b64decode
from typing import Optional

import httpx

from .phash import hamming_distance

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
REFRESH_SEC = int(os.environ.get("PHASH_INDEX_TTL", "600"))


class _PhashEntry:
    __slots__ = (
        "card_id",
        "set_code",
        "card_no",
        "variant",
        "rarity",
        "name_ja",
        "image_url",
        "phash",
        "brand",
    )

    def __init__(self, row: dict):
        self.card_id: str = row["id"]
        self.set_code: str = row["set_code"]
        self.card_no: str = row["card_no"]
        self.variant: str = row.get("variant", "normal")
        self.rarity: str = row.get("rarity", "")
        self.name_ja: str = row.get("name_ja", "")
        self.image_url: Optional[str] = row.get("image_url")
        self.brand: str = row.get("brand", "onepiece")

        # Supabase は bytea を "\\x..." 16進文字列で返す
        raw = row.get("image_phash")
        if isinstance(raw, str) and raw.startswith("\\x"):
            self.phash = bytes.fromhex(raw[2:])
        elif isinstance(raw, bytes):
            self.phash = raw
        else:
            self.phash = None  # type: ignore


class PhashIndex:
    def __init__(self) -> None:
        self._entries: list[_PhashEntry] = []
        self._loaded_at: float = 0.0
        self._lock = asyncio.Lock()

    async def _fetch(self, brand: Optional[str] = None) -> list[_PhashEntry]:
        if not SUPABASE_URL or not SUPABASE_KEY:
            return []
        select = "id,brand,set_code,card_no,variant,rarity,name_ja,image_url,image_phash"
        base = (
            f"{SUPABASE_URL}/rest/v1/cards"
            f"?image_phash=not.is.null&select={select}&order=id"
        )
        if brand:
            base += f"&brand=eq.{brand}"

        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        }
        page = 1000
        rows: list[dict] = []
        async with httpx.AsyncClient() as client:
            offset = 0
            while True:
                res = await client.get(
                    f"{base}&limit={page}&offset={offset}",
                    headers=headers,
                    timeout=30,
                )
                res.raise_for_status()
                chunk = res.json()
                rows.extend(chunk)
                if len(chunk) < page:
                    break
                offset += page
        return [_PhashEntry(r) for r in rows]

    async def ensure_loaded(self) -> None:
        if self._entries and (time.time() - self._loaded_at) < REFRESH_SEC:
            return
        async with self._lock:
            if self._entries and (time.time() - self._loaded_at) < REFRESH_SEC:
                return
            try:
                self._entries = await self._fetch()
                self._loaded_at = time.time()
            except Exception as e:
                # 失敗時は古いキャッシュを使い続ける
                print(f"[phash_index] reload failed: {e}")

    async def nearest(
        self,
        query_phash: bytes,
        brand: Optional[str] = None,
        max_distance: int = 32,
        limit: int = 5,
    ) -> list[dict]:
        await self.ensure_loaded()
        candidates: list[tuple[int, _PhashEntry]] = []
        for e in self._entries:
            if e.phash is None:
                continue
            if brand and e.brand != brand:
                continue
            d = hamming_distance(query_phash, e.phash)
            if d <= max_distance:
                candidates.append((d, e))
        candidates.sort(key=lambda x: x[0])

        # 同じ (set_code, card_no) のバリアントが上位にダブった場合、最も近い1件のみ残す
        seen_codes: set[tuple[str, str]] = set()
        result: list[dict] = []
        for d, e in candidates:
            key = (e.set_code, e.card_no)
            if key in seen_codes:
                continue
            seen_codes.add(key)
            result.append(
                {
                    "card_id": e.card_id,
                    "set_code": e.set_code,
                    "card_no": e.card_no,
                    "variant": e.variant,
                    "rarity": e.rarity,
                    "name_ja": e.name_ja,
                    "image_url": e.image_url,
                    "distance": d,
                }
            )
            if len(result) >= limit:
                break
        return result


# モジュール単一インスタンス
phash_index = PhashIndex()
