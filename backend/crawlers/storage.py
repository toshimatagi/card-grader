"""Supabaseへのカード・価格データ保存"""

from __future__ import annotations

import os
from typing import Optional

import httpx

from .base import CrawledCard

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


def _headers(prefer: str = "return=representation") -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


# プレースホルダ/無効な画像URLパターン
_INVALID_IMAGE_PATTERNS = (
    "spacer.gif",
    "noimage",
    "no_image",
    "no-image",
    "/blank.gif",
)


def _is_valid_image_url(url: Optional[str]) -> bool:
    if not url:
        return False
    s = url.strip().lower()
    if not s:
        return False
    return not any(p in s for p in _INVALID_IMAGE_PATTERNS)


async def upsert_card(client: httpx.AsyncClient, card: CrawledCard) -> Optional[str]:
    """cards をUPSERT して card_id を返す。失敗時は None。

    image_url は無効値 (None/空/spacer.gif 等のプレースホルダ) で
    既存の有効値を上書きしない。新値が有効な場合のみ更新する。
    """
    payload = {
        "brand": card.brand,
        "set_code": card.set_code,
        "card_no": card.card_no,
        "variant": card.variant,
        "rarity": card.rarity,
        "name_ja": card.name_ja,
    }
    # 新 image_url が有効な場合のみ payload に含める。
    # 含まれない場合 PostgREST の merge-duplicates は他カラムだけ更新し
    # 既存 image_url を保持する。
    if _is_valid_image_url(card.image_url):
        payload["image_url"] = card.image_url

    # on_conflict で unique(brand,set_code,card_no,variant,rarity) にマッチしたらUPDATE
    url = (
        f"{SUPABASE_URL}/rest/v1/cards"
        "?on_conflict=brand,set_code,card_no,variant,rarity"
    )
    headers = _headers("return=representation,resolution=merge-duplicates")
    resp = await client.post(url, headers=headers, json=payload, timeout=15)
    if resp.status_code >= 400:
        return None
    rows = resp.json()
    return rows[0]["id"] if rows else None


async def upsert_external_id(
    client: httpx.AsyncClient, card_id: str, source: str, source_card_id: str, source_url: Optional[str]
) -> None:
    payload = {
        "card_id": card_id,
        "source": source,
        "source_card_id": source_card_id,
        "source_url": source_url,
    }
    url = f"{SUPABASE_URL}/rest/v1/card_external_ids?on_conflict=card_id,source"
    headers = _headers("return=minimal,resolution=merge-duplicates")
    await client.post(url, headers=headers, json=payload, timeout=15)


async def insert_snapshot(
    client: httpx.AsyncClient,
    card_id: str,
    source: str,
    price_type: str,
    price: Optional[int],
    stock_status: Optional[str],
    raw: dict,
) -> None:
    """price_snapshots に新規行を追加。

    重複防止: 直近 6時間以内に同じ (card_id, source, price_type, price, stock_status)
    の snapshot があれば skip。これがないと hourly cron で同じ値段を何度も記録して
    DB 容量と Disk I/O を圧迫する (実測: 直近7日のうち71% が同値重複)。
    """
    # 直近 6時間に同値 snapshot があるかチェック (PostgREST 1リクエスト)
    since = "now() - interval '6 hours'"  # PostgREST 側で評価できないので ISO で渡す
    from datetime import datetime, timezone, timedelta
    since_iso = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
    check_url = (
        f"{SUPABASE_URL}/rest/v1/price_snapshots"
        f"?card_id=eq.{card_id}"
        f"&source=eq.{source}"
        f"&price_type=eq.{price_type}"
        f"&captured_at=gte.{since_iso}"
        f"&select=price,stock_status&limit=1&order=captured_at.desc"
    )
    try:
        check = await client.get(check_url, headers=_headers("return=representation"), timeout=10)
        if check.status_code == 200:
            rows = check.json()
            if rows:
                last = rows[0]
                if last.get("price") == price and last.get("stock_status") == stock_status:
                    return  # 重複、skip
    except Exception:
        pass  # check 失敗時は insert にフォールバック

    payload = {
        "card_id": card_id,
        "source": source,
        "price_type": price_type,
        "price": price,
        "stock_status": stock_status,
        "raw": raw,
    }
    url = f"{SUPABASE_URL}/rest/v1/price_snapshots"
    headers = _headers("return=minimal")
    await client.post(url, headers=headers, json=payload, timeout=15)


async def start_run(
    client: httpx.AsyncClient,
    source: str,
    scope: str,
    brand: Optional[str] = None,
) -> Optional[int]:
    """crawl_runs に running 行を1件挿入し id を返す。

    brand を渡すと crawl_runs.brand に保存される。migration 007 (brand列追加) が
    未適用の Supabase でも動かせるよう、PostgREST が 'unknown column brand' で
    400 を返したら brand なしで再試行する。
    """
    url = f"{SUPABASE_URL}/rest/v1/crawl_runs"
    payload: dict = {"source": source, "scope": scope, "status": "running"}
    if brand:
        payload["brand"] = brand
        resp = await client.post(url, headers=_headers(), json=payload, timeout=15)
        if resp.status_code == 400:
            # migration 未適用の可能性。brand を抜いて再試行
            payload.pop("brand", None)
            resp = await client.post(url, headers=_headers(), json=payload, timeout=15)
    else:
        resp = await client.post(url, headers=_headers(), json=payload, timeout=15)
    if resp.status_code >= 400:
        return None
    rows = resp.json()
    return rows[0]["id"] if rows else None


async def finish_run(
    client: httpx.AsyncClient,
    run_id: int,
    status: str,
    items_count: int,
    error: Optional[str] = None,
) -> None:
    payload = {
        "status": status,
        "items_count": items_count,
        "finished_at": "now()",
        "error": error,
    }
    # PostgREST は "now()" を文字列扱いするので、finished_at は PATCH 側で default に任せず明示ISOで
    from datetime import datetime, timezone
    payload["finished_at"] = datetime.now(timezone.utc).isoformat()

    url = f"{SUPABASE_URL}/rest/v1/crawl_runs?id=eq.{run_id}"
    await client.patch(url, headers=_headers("return=minimal"), json=payload, timeout=15)


async def save_crawled(cards: list[CrawledCard]) -> int:
    """取得データをまとめて保存。保存成功件数を返す。"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_KEY 未設定")

    saved = 0
    async with httpx.AsyncClient() as client:
        for c in cards:
            card_id = await upsert_card(client, c)
            if not card_id:
                continue
            await upsert_external_id(
                client, card_id, c.source, c.source_card_id, c.source_url
            )
            await insert_snapshot(
                client, card_id, c.source, c.price_type, c.price, c.stock_status, c.raw
            )
            saved += 1
    return saved
