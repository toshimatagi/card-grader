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


async def upsert_card(client: httpx.AsyncClient, card: CrawledCard) -> Optional[str]:
    """cards をUPSERT して card_id を返す。失敗時は None。"""
    payload = {
        "brand": card.brand,
        "set_code": card.set_code,
        "card_no": card.card_no,
        "variant": card.variant,
        "rarity": card.rarity,
        "name_ja": card.name_ja,
        "image_url": card.image_url,
    }
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


async def start_run(client: httpx.AsyncClient, source: str, scope: str) -> Optional[int]:
    payload = {"source": source, "scope": scope, "status": "running"}
    url = f"{SUPABASE_URL}/rest/v1/crawl_runs"
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
