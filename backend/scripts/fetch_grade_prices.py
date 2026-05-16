"""グレード別 (Raw / PSA10 / PSA9) 価格を Yahoo Auctions 終了オークション
から集計し Supabase の `card_grade_prices` テーブルに upsert する。

データソース: https://auctions.yahoo.co.jp/closedsearch/closedsearch (落札済み)
- Next.js __NEXT_DATA__ にアイテムが JSON 埋め込みされている (SSR)
- 1ページ最大 50 件、price (落札価格), title, bidCount, endTime を抽出
- メルカリは JS-render なので server-side で取れない → Yahoo を採用

呼び出し例:
  python -m backend.scripts.fetch_grade_prices --brand pokemon --limit 50
  python -m backend.scripts.fetch_grade_prices --brand onepiece --limit 30 --delay 6
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

YAUC_BASE = "https://auctions.yahoo.co.jp/closedsearch/closedsearch"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
    "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.8",
}

NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__"[^>]*>(.+?)</script>', re.DOTALL
)


async def fetch_sold_yauc(
    client: httpx.AsyncClient,
    keyword: str,
    *,
    min_price: int = 50,
    max_price: int = 5_000_000,
) -> list[dict]:
    """Yahoo Auctions 終了オークションから (price, title, bidCount) を返す"""
    params = {"p": keyword, "va": keyword, "auctype": "category"}
    qs = "&".join(f"{k}={quote_plus(str(v))}" for k, v in params.items())
    url = f"{YAUC_BASE}?{qs}"
    try:
        r = await client.get(url, headers=HEADERS, timeout=25)
        r.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException):
        return []

    m = NEXT_DATA_RE.search(r.text)
    if not m:
        return []
    try:
        data = json.loads(m.group(1))
        items = (
            data.get("props", {})
                .get("pageProps", {})
                .get("initialState", {})
                .get("search", {})
                .get("items", {})
                .get("listing", {})
                .get("items", [])
        )
    except (json.JSONDecodeError, AttributeError):
        return []

    out = []
    for it in items:
        price = it.get("price")
        if price is None or price < min_price or price > max_price:
            continue
        out.append({
            "price": price,
            "title": it.get("title", ""),
            "bidCount": it.get("bidCount", 0),
            "auctionId": it.get("auctionId"),
            "endTime": it.get("endTime"),
        })
    return out


def filter_by_keywords(
    items: list[dict],
    must_include: list[str],
    must_exclude: list[str],
) -> list[dict]:
    """title に must_include 全てを含み、must_exclude を一切含まないものに絞る"""
    out = []
    for it in items:
        t = it["title"]
        if not all(w in t for w in must_include):
            continue
        if any(w in t for w in must_exclude):
            continue
        out.append(it)
    return out


def aggregate(items: list[dict]) -> Optional[dict]:
    if len(items) < 3:
        return None
    prices = [it["price"] for it in items]
    return {
        "price_median": int(statistics.median(prices)),
        "price_min": min(prices),
        "price_max": max(prices),
        "sample_count": len(prices),
        "samples": [
            {"p": it["price"], "t": it["title"][:80], "id": it["auctionId"]}
            for it in items[:10]
        ],
    }


async def _paginate_get(
    client: httpx.AsyncClient,
    url: str,
    page_size: int = 1000,
) -> list[dict]:
    """PostgREST は単一リクエストで 1000 行以上返さない (server-side cap)。
    Range ヘッダで chunk して全行取得する。

    重要: httpx の `params=` は URL に既存のクエリ文字列を**上書き**してしまうため
    使えない。クエリは url にすべて埋め込んで渡すこと。"""
    out: list[dict] = []
    offset = 0
    while True:
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Range-Unit": "items",
            "Range": f"{offset}-{offset + page_size - 1}",
        }
        r = await client.get(url, headers=headers, timeout=30)
        r.raise_for_status()
        chunk = r.json()
        if not chunk:
            break
        out.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return out


async def fetch_cards_to_process(
    client: httpx.AsyncClient,
    brand: str,
    limit: int,
    *,
    skip_existing: bool = True,
    skip_within_hours: int = 168,
    prefer_uncovered: bool = True,
) -> list[dict]:
    """rarity != 'UNKNOWN' の代表カード (高レア優先) を取得。

    - skip_existing=True: 直近 skip_within_hours 以内に取得済みの card_id を除外
    - prefer_uncovered=True: card_grade_prices_latest に1度も登録されていない
      カード (= true backfill 対象) を優先キューイング。残り枠を recent スキップ
      後のカードで埋める。
    """
    high_rarity = [
        # 共通 / ポケカ
        "SAR", "UR", "SR", "SSR", "CHR", "ACE", "HR",
        "AR", "MUR", "RRR", "RR", "RAR",
        # ワンピ
        "SEC", "P-SEC", "L", "SP", "P-SR",
    ]
    rarity_filter = "rarity=in.(" + ",".join(high_rarity) + ")"

    # 1. 直近処理済みの card_id を収集 (paginate)
    skip_ids: set[str] = set()
    if skip_existing:
        from datetime import datetime, timezone, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=skip_within_hours)).isoformat()
        try:
            rows = await _paginate_get(
                client,
                f"{SUPABASE_URL}/rest/v1/card_grade_prices"
                f"?select=card_id&captured_at=gte.{quote_plus(cutoff)}",
            )
            for row in rows:
                skip_ids.add(row["card_id"])
            print(
                f"[*] skip-list: {len(skip_ids)} distinct card_ids scraped "
                f"within last {skip_within_hours}h",
                file=sys.stderr,
            )
        except Exception as e:
            print(f"[warn] skip-list fetch failed: {e}", file=sys.stderr)

    # 2. 過去に1度でも grade_price がある card_id を全件収集 (paginate)
    covered_ids: set[str] = set()
    if prefer_uncovered:
        try:
            rows = await _paginate_get(
                client,
                f"{SUPABASE_URL}/rest/v1/card_grade_prices_latest?select=card_id",
            )
            for row in rows:
                covered_ids.add(row["card_id"])
            print(
                f"[*] coverage: {len(covered_ids)} distinct cards have any grade_price",
                file=sys.stderr,
            )
        except Exception as e:
            print(f"[warn] coverage fetch failed: {e}", file=sys.stderr)

    # 3. 候補カードを多めに取得
    cards_url = (
        f"{SUPABASE_URL}/rest/v1/cards?"
        f"{rarity_filter}"
        f"&brand=eq.{brand}"
        f"&variant=eq.normal"
        f"&select=id,set_code,card_no,name_ja,rarity"
        f"&order=updated_at.desc"
    )
    all_cards = await _paginate_get(client, cards_url)

    # 4. skip_ids 除外
    remaining = [c for c in all_cards if c["id"] not in skip_ids]
    if skip_ids:
        print(
            f"[*] after skip_existing: {len(remaining)}/{len(all_cards)} cards eligible",
            file=sys.stderr,
        )

    # 5. 未カバーカードを優先 (true backfill)
    if prefer_uncovered:
        uncovered = [c for c in remaining if c["id"] not in covered_ids]
        already_covered = [c for c in remaining if c["id"] in covered_ids]
        ordered = uncovered + already_covered
        print(
            f"[*] queue order: {len(uncovered)} uncovered first, "
            f"then {len(already_covered)} previously-covered",
            file=sys.stderr,
        )
    else:
        ordered = remaining

    return ordered[:limit]


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
        "source": "yahoo_auctions",
        "price_median": aggregated["price_median"],
        "price_min": aggregated["price_min"],
        "price_max": aggregated["price_max"],
        "sample_count": aggregated["sample_count"],
        "raw": {**raw_meta, "samples": aggregated.get("samples", [])},
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
        print(f"  [ERR] upsert {grade}: {r.status_code} {r.text[:200]}",
              file=sys.stderr)
        return False
    return True


async def process_card(
    client: httpx.AsyncClient,
    card: dict,
    delay: float,
) -> dict:
    """1カードに対して Raw / PSA10 / PSA9 の3グレードを取得"""
    code = f"{card['set_code']}-{card['card_no']}"
    name = card["name_ja"]

    # 検索キーワードはバリエーション複数試して最も多くヒットしたものを採用
    base_kws = [f"{code} {name}", name]

    grade_configs = [
        ("psa10", ["PSA10", "PSA 10"], ["PSA9", "PSA 9", "PSA8", "BGS"]),
        ("psa9", ["PSA9", "PSA 9"], ["PSA10", "PSA 10", "PSA8", "BGS"]),
        ("raw", [], ["PSA", "BGS", "ARS", "SGC", "鑑定", "ポーセリン"]),
    ]

    results = {}
    for grade, must_inc, must_exc in grade_configs:
        best_items: list[dict] = []
        used_kw = ""
        for base in base_kws:
            kw = base + (" " + must_inc[0] if must_inc else "")
            items = await fetch_sold_yauc(client, kw)
            # PSA10/9 はフィルタ厳しめに、Raw は除外語のみ
            if must_inc:
                items = filter_by_keywords(items, [must_inc[0]], must_exc)
            else:
                items = filter_by_keywords(items, [], must_exc)
            if len(items) > len(best_items):
                best_items = items
                used_kw = kw
            await asyncio.sleep(delay + random.uniform(0, 1.0))
            if len(best_items) >= 5:
                break

        agg = aggregate(best_items)
        results[grade] = {"keyword": used_kw, "count": len(best_items), "agg": agg}
        if agg:
            ok = await upsert_grade_price(
                client,
                card["id"],
                grade,
                agg,
                {"keyword": used_kw, "fetched_at": int(time.time())},
            )
            results[grade]["upserted"] = ok

    return results


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--brand", default="pokemon")
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--delay", type=float, default=4.0)
    ap.add_argument(
        "--no-prefer-uncovered",
        action="store_true",
        help="未カバーカード優先化を無効化 (recent refresh mode)",
    )
    ap.add_argument(
        "--no-skip-existing",
        action="store_true",
        help="直近7日 skip も無効化 (フル再スクレイプ用)",
    )
    args = ap.parse_args()

    async with httpx.AsyncClient() as client:
        cards = await fetch_cards_to_process(
            client,
            args.brand,
            args.limit,
            skip_existing=not args.no_skip_existing,
            prefer_uncovered=not args.no_prefer_uncovered,
        )
        print(f"[*] processing {len(cards)} cards (high rarity, brand={args.brand})",
              file=sys.stderr)

        success_count = {g: 0 for g in ("psa10", "psa9", "raw")}
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
                    success_count[grade] += 1
                    print(
                        f"  {grade}: median=¥{agg['price_median']:,} "
                        f"({agg['sample_count']} samples, kw=\"{info['keyword'][:40]}\")",
                        file=sys.stderr,
                    )
                else:
                    print(
                        f"  {grade}: insufficient ({info['count']} samples)",
                        file=sys.stderr,
                    )

        print(f"\n[*] summary:", file=sys.stderr)
        for g, c in success_count.items():
            print(f"  {g}: {c}/{len(cards)} cards with data", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())
