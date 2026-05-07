"""グレード別 (Raw / PSA10 / PSA9) 価格をメルカリ売り切れ検索から集計し
Supabase の `card_grade_prices` テーブルに upsert する。

メルカリ検索: https://jp.mercari.com/search?keyword={KW}&status=sold_out
HTML には初期 state を埋め込んでいる JSON があるためそこから抽出。
JS-render は不要 (SSR 済み)。

呼び出し例:
  python -m backend.scripts.fetch_grade_prices --brand pokemon --limit 50

データ取得方針:
  - PSA10 / PSA9 / Raw の3グレードを各カードに対して取得
  - Raw キーワード: "{set_code}-{card_no} {name_ja}" (なければ skip)
  - PSA10 キーワード: 上記 + " PSA10" or " PSA 10"
  - PSA9 キーワード: 上記 + " PSA9" or " PSA 9"
  - 売り切れ価格を最大40件まで取得し median/min/max/sample_count を計算
  - sample_count >= 3 の場合のみ DB に upsert (ノイズ低減)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import re
import statistics
import sys
import time
from typing import Optional
from urllib.parse import quote_plus

import httpx

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

MERCARI_BASE = "https://jp.mercari.com/search"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
    "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.8",
}

# 価格抽出: "data-price":1234  形式 + JSON-LD
PRICE_JSON_RE = re.compile(r'"price"\s*:\s*(\d+)')
ITEM_BLOCK_RE = re.compile(r'"id"\s*:\s*"[a-z0-9]+"[^}]+?"price"\s*:\s*(\d+)')


async def fetch_sold(client: httpx.AsyncClient, keyword: str) -> list[int]:
    """メルカリ売り切れ検索から価格リストを抽出"""
    params = {
        "keyword": keyword,
        "status": "sold_out",
        "sort": "created_time",
        "order": "desc",
    }
    qs = "&".join(f"{k}={quote_plus(v)}" for k, v in params.items())
    url = f"{MERCARI_BASE}?{qs}"
    try:
        r = await client.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException):
        return []

    text = r.text
    prices: list[int] = []
    for m in PRICE_JSON_RE.finditer(text):
        p = int(m.group(1))
        if 100 <= p <= 5_000_000:  # 妥当性フィルタ
            prices.append(p)
    return prices[:40]


def aggregate(prices: list[int]) -> Optional[dict]:
    if len(prices) < 3:
        return None
    return {
        "price_median": int(statistics.median(prices)),
        "price_min": min(prices),
        "price_max": max(prices),
        "sample_count": len(prices),
    }


async def fetch_cards_to_process(
    client: httpx.AsyncClient,
    brand: str,
    limit: int,
) -> list[dict]:
    """対象カード一覧 (variant=normal で代表的なものを優先) を Supabase から取得"""
    # rarity != 'UNKNOWN' の有名カードを優先 (stub だらけのテーブル汚染を避ける)
    qs = (
        f"brand=eq.{brand}"
        f"&rarity=not.eq.UNKNOWN"
        f"&variant=eq.normal"
        f"&select=id,set_code,card_no,name_ja,rarity"
        f"&order=updated_at.desc"
        f"&limit={limit}"
    )
    r = await client.get(
        f"{SUPABASE_URL}/rest/v1/cards?{qs}",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
    )
    r.raise_for_status()
    return r.json()


async def upsert_grade_price(
    client: httpx.AsyncClient,
    card_id: str,
    grade: str,
    aggregated: dict,
    raw_meta: dict,
) -> bool:
    payload = {
        "card_id": card_id,
        "grade": grade,
        "source": "mercari",
        "price_median": aggregated["price_median"],
        "price_min": aggregated["price_min"],
        "price_max": aggregated["price_max"],
        "sample_count": aggregated["sample_count"],
        "raw": raw_meta,
    }
    r = await client.post(
        f"{SUPABASE_URL}/rest/v1/card_grade_prices",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=payload,
        timeout=30,
    )
    if r.status_code >= 300:
        print(f"  [ERR] upsert: {r.status_code} {r.text[:200]}", file=sys.stderr)
        return False
    return True


async def process_card(client: httpx.AsyncClient, card: dict, delay: float) -> dict:
    code = f"{card['set_code']}-{card['card_no']}"
    name = card["name_ja"]
    base_kw = f"{code} {name}"

    results = {}
    for grade, suffix in [("psa10", " PSA10"), ("psa9", " PSA9"), ("raw", "")]:
        kw = base_kw + suffix
        prices = await fetch_sold(client, kw)
        agg = aggregate(prices)
        results[grade] = {"keyword": kw, "prices": prices, "agg": agg}
        if agg:
            ok = await upsert_grade_price(
                client,
                card["id"],
                grade,
                agg,
                {"keyword": kw, "fetched_at": int(time.time())},
            )
            results[grade]["upserted"] = ok
        await asyncio.sleep(delay + random.uniform(0, 1.5))

    return results


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--brand", default="pokemon")
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--delay", type=float, default=4.0)
    args = ap.parse_args()

    async with httpx.AsyncClient() as client:
        cards = await fetch_cards_to_process(client, args.brand, args.limit)
        print(f"[*] processing {len(cards)} cards", file=sys.stderr)

        for i, card in enumerate(cards, 1):
            code = f"{card['set_code']}-{card['card_no']}"
            print(f"[{i}/{len(cards)}] {code} {card['name_ja']} ({card['rarity']})",
                  file=sys.stderr)
            try:
                res = await process_card(client, card, args.delay)
            except Exception as e:
                print(f"  [ERR] {e}", file=sys.stderr)
                continue
            for grade, info in res.items():
                agg = info.get("agg")
                if agg:
                    print(
                        f"  {grade}: median=¥{agg['price_median']:,} "
                        f"({agg['sample_count']} samples)",
                        file=sys.stderr,
                    )
                else:
                    print(f"  {grade}: insufficient samples", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())
