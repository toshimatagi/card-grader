"""pokemon-card.com 公式 SPA 越しに過去2年分のポケカマスターを取得して
Supabase に price 無しの stub レコードとして登録する。

jina.ai リーダー (r.jina.ai) を使って Vue SPA の DOM 描画後コンテンツを
markdown で取得し、画像 URL のパスから set_slug と global_id を抽出する。

使い方:
  python -m backend.scripts.fetch_pokemon_master --pages 90-135 --dry-run
  python -m backend.scripts.fetch_pokemon_master --pages 90-135 --past-2years-only
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from collections import defaultdict
from typing import Optional

import httpx

JINA_BASE = "https://r.jina.ai/https://www.pokemon-card.com/card-search/"
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

# pokemon-card.com の expansion slug → 当 DB の set_code 正規化マッピング
# DB 上の set_code は数字部 2 桁ゼロ埋め (M04, M02A, SV10A 等)
PCC_SLUG_TO_SET_CODE: dict[str, str] = {
    # MEGA series
    "M1": "M01", "M1L": "M01L", "M1S": "M01S",
    "M1A": "M01A", "M1B": "M01B",
    "M2": "M02", "M2A": "M02A", "M2B": "M02B",
    "M3": "M03", "M3A": "M03A",
    "M4": "M04", "M4A": "M04A",
    # SV series
    "SV1S": "SV1S", "SV1V": "SV1V", "SV1A": "SV1A",
    "SV2D": "SV2D", "SV2P": "SV2P", "SV2A": "SV2A",
    "SV3": "SV3", "SV3A": "SV3A",
    "SV4K": "SV4K", "SV4M": "SV4M", "SV4A": "SV4A",
    "SV5K": "SV5K", "SV5M": "SV5M", "SV5A": "SV5A",
    "SV6": "SV6", "SV6A": "SV6A",
    "SV7": "SV7", "SV7A": "SV7A", "SV7P": "SV7P",
    "SV8": "SV8", "SV8A": "SV8A", "SV8B": "SV8B",
    "SV9": "SV9", "SV9A": "SV9A",
    "SV10": "SV10", "SV10A": "SV10A",
    "SV11": "SV11",  # アビスアイ (将来)
}

# 過去2年分 (今が 2026-05) として残す set。それ以外は stub 登録しない。
PAST_2YEARS_CODES = {
    "M01", "M01L", "M01S", "M01A", "M01B",
    "M02", "M02A", "M02B",
    "M03", "M03A",
    "M04", "M04A",
    "SV6", "SV6A",
    "SV7", "SV7A", "SV7P",
    "SV8", "SV8A", "SV8B",
    "SV9", "SV9A",
    "SV10", "SV10A",
}

# 画像URL: https://www.pokemon-card.com/assets/images/card_images/large/{SLUG}/{GID}_P_{KANA}.jpg
IMG_URL_RE = re.compile(
    r"https?://www\.pokemon-card\.com/assets/images/card_images/large/([A-Z0-9]+)/(\d{6})_[A-Z]_([A-Z0-9]+)\.jpg"
)
# markdown alt 行: ![Image N: 名前](URL)
NAME_ALT_RE = re.compile(r"!\[Image \d+: ([^\]]+)\]\((https?://[^\)]+)\)")


async def fetch_page(client: httpx.AsyncClient, page: int) -> str:
    url = f"{JINA_BASE}?pg={page}"
    for attempt in range(3):
        try:
            r = await client.get(url, timeout=60)
            r.raise_for_status()
            return r.text
        except (httpx.HTTPError, httpx.TimeoutException) as e:
            if attempt == 2:
                print(f"[ERR] page {page}: {e}", file=sys.stderr)
                return ""
            await asyncio.sleep(2 ** attempt)
    return ""


def parse_page(markdown: str) -> list[dict]:
    out: list[dict] = []
    for m in NAME_ALT_RE.finditer(markdown):
        name = m.group(1).strip()
        url = m.group(2).strip()
        img_match = IMG_URL_RE.search(url)
        if not img_match:
            continue
        slug, gid, _kana = img_match.groups()
        out.append({
            "slug": slug,
            "global_id": int(gid),
            "name_ja": name,
            "image_url": img_match.group(0),
        })
    return out


async def fetch_all(pages: list[int], concurrency: int = 4) -> list[dict]:
    sem = asyncio.Semaphore(concurrency)
    results: list[dict] = []

    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}) as client:
        async def fetch_one(p: int):
            async with sem:
                md = await fetch_page(client, p)
                cards = parse_page(md)
                print(f"  pg={p}: {len(cards)} cards", file=sys.stderr)
                results.extend(cards)

        await asyncio.gather(*[fetch_one(p) for p in pages])
    return results


def assign_card_no(cards: list[dict]) -> dict[str, list[dict]]:
    by_slug: dict[str, list[dict]] = defaultdict(list)
    for c in cards:
        by_slug[c["slug"]].append(c)

    for slug in by_slug:
        seen = set()
        uniq = []
        for c in sorted(by_slug[slug], key=lambda x: x["global_id"]):
            if c["global_id"] in seen:
                continue
            seen.add(c["global_id"])
            uniq.append(c)
        for i, c in enumerate(uniq, start=1):
            c["card_no"] = f"{i:03d}"
        by_slug[slug] = uniq
    return dict(by_slug)


async def upsert_to_supabase(rows: list[dict]) -> int:
    if not rows:
        return 0
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    inserted = 0
    async with httpx.AsyncClient() as client:
        for i in range(0, len(rows), 200):
            chunk = rows[i:i + 200]
            r = await client.post(
                f"{SUPABASE_URL}/rest/v1/cards?on_conflict=brand,set_code,card_no,variant",
                headers=headers,
                json=chunk,
                timeout=60,
            )
            if r.status_code >= 300:
                print(f"[ERR] supabase {r.status_code}: {r.text[:300]}", file=sys.stderr)
                continue
            inserted += len(chunk)
    return inserted


def parse_pages_arg(spec: str) -> list[int]:
    out: set[int] = set()
    for token in spec.split(","):
        token = token.strip()
        if "-" in token:
            a, b = token.split("-", 1)
            out.update(range(int(a), int(b) + 1))
        elif token:
            out.add(int(token))
    return sorted(out)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", default="90-135", help="例: 1-135 / 90-135 / 1,5,10")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--out", default="/tmp/pokemon_master.json")
    ap.add_argument("--past-2years-only", action="store_true",
                    help="DB 投入対象を過去2年分セットに限定")
    args = ap.parse_args()

    pages = parse_pages_arg(args.pages)
    print(f"[*] fetching {len(pages)} pages with concurrency={args.concurrency}", file=sys.stderr)

    cards = await fetch_all(pages, concurrency=args.concurrency)
    print(f"[*] got {len(cards)} raw card rows", file=sys.stderr)

    by_slug = assign_card_no(cards)
    print("--- by slug ---", file=sys.stderr)
    for slug, items in sorted(by_slug.items()):
        ids = [c["global_id"] for c in items]
        print(f"  {slug}: {len(items)} cards (gid {min(ids)}-{max(ids)})", file=sys.stderr)

    rows = []
    for slug, items in by_slug.items():
        set_code = PCC_SLUG_TO_SET_CODE.get(slug)
        if not set_code:
            print(f"  [skip] unknown slug: {slug}", file=sys.stderr)
            continue
        if args.past_2years_only and set_code not in PAST_2YEARS_CODES:
            continue
        for c in items:
            rows.append({
                "brand": "pokemon",
                "set_code": set_code,
                "card_no": c["card_no"],
                "variant": "normal",
                "rarity": "UNKNOWN",
                "name_ja": c["name_ja"],
                "image_url": c["image_url"],
            })

    print(f"[*] {len(rows)} rows ready for DB", file=sys.stderr)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"by_slug": by_slug, "rows": rows}, f, ensure_ascii=False, indent=2)
    print(f"[*] dumped to {args.out}", file=sys.stderr)

    if args.dry_run:
        print("[*] dry-run, skipping DB upsert", file=sys.stderr)
        return

    inserted = await upsert_to_supabase(rows)
    print(f"[*] upserted {inserted} rows", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())
