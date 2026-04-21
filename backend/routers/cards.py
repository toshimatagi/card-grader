"""カード検索・価格推移APIルーター"""

from __future__ import annotations

import os
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/v1/cards", tags=["cards"])

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")


def _headers() -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


async def _sb_get(path: str, params: Optional[str] = None) -> list[dict]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(500, "Supabase 環境変数未設定")
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url = f"{url}?{params}" if "?" not in url else f"{url}&{params}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_headers(), timeout=15)
        if resp.status_code >= 400:
            raise HTTPException(resp.status_code, resp.text)
        return resp.json()


@router.get("/search")
async def search_cards(
    brand: str = "onepiece",
    set_code: Optional[str] = None,
    q: Optional[str] = Query(None, description="カード名部分一致"),
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """カード検索（一覧）。型番ごとのカード定義を返す。"""
    filters = [f"brand=eq.{brand}"]
    if set_code:
        filters.append(f"set_code=eq.{set_code.upper()}")
    if q:
        filters.append(f"name_ja=ilike.*{q}*")

    select = "id,brand,set_code,card_no,variant,rarity,name_ja,image_url"
    params = "&".join(filters) + (
        f"&select={select}"
        f"&order=set_code.asc,card_no.asc,variant.asc"
        f"&limit={limit}&offset={offset}"
    )
    items = await _sb_get("cards", params)
    return {"items": items, "count": len(items)}


@router.get("/by-code/{code}")
async def get_card_by_code(code: str) -> dict:
    """型番（OP15-007 等）指定でvariant全件 + 最新価格 + 価格推移を返す"""
    code_u = code.upper().replace(" ", "")
    if "-" not in code_u:
        raise HTTPException(400, "型番は 'OP15-007' の形式で指定してください")
    set_code, _, card_no = code_u.partition("-")
    card_no = card_no.zfill(3)

    # 1. cards 行（variant別）
    select = "id,brand,set_code,card_no,variant,rarity,name_ja,image_url"
    cards = await _sb_get(
        "cards",
        f"set_code=eq.{set_code}&card_no=eq.{card_no}&select={select}&order=variant.asc,rarity.asc",
    )
    if not cards:
        raise HTTPException(404, f"{code_u} が見つかりません")

    ids = ",".join(c["id"] for c in cards)

    # 2. 価格推移（各cardのsnapshotを最大500件ずつ）
    snap_select = "card_id,source,captured_at,price_type,price,stock_status"
    snapshots = await _sb_get(
        "price_snapshots",
        f"card_id=in.({ids})&select={snap_select}&order=captured_at.asc&limit=10000",
    )

    # cardごとにまとめる
    by_card: dict[str, list[dict]] = {c["id"]: [] for c in cards}
    for s in snapshots:
        by_card.setdefault(s["card_id"], []).append(s)

    result_cards = []
    for c in cards:
        history = by_card.get(c["id"], [])
        latest_sell = next(
            (h for h in reversed(history) if h["price_type"] == "sell" and h.get("price") is not None),
            None,
        )
        latest_buy = next(
            (h for h in reversed(history) if h["price_type"] == "buy" and h.get("price") is not None),
            None,
        )
        result_cards.append({
            **c,
            "latest_sell_price": latest_sell.get("price") if latest_sell else None,
            "latest_buy_price": latest_buy.get("price") if latest_buy else None,
            "history": history,
        })

    return {
        "code": f"{set_code}-{card_no}",
        "cards": result_cards,
    }


@router.get("/sets")
async def list_sets(brand: str = "onepiece") -> dict:
    """ブランド内に存在するセットコード一覧（カード枚数カウント付き）"""
    items = await _sb_get(
        "cards",
        f"brand=eq.{brand}&select=set_code",
    )
    counts: dict[str, int] = {}
    for it in items:
        counts[it["set_code"]] = counts.get(it["set_code"], 0) + 1
    sets = [{"set_code": k, "count": v} for k, v in sorted(counts.items())]
    return {"sets": sets}
