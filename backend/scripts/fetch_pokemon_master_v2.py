"""pokemon-card.com SPA を jina.ai 越しに sequential paginate。

slow + cache-busting で 135 ページ全件取得を試みる。jina.ai の rate limit に
当たった場合は exponential backoff でリトライ。set_slug + global_id + name +
image_url を JSON に dump し、別スクリプトで DB へ投入する。

使い方:
  python -m backend.scripts.fetch_pokemon_master_v2 --pages 1-135
  python -m backend.scripts.fetch_pokemon_master_v2 --pages 90-135 --delay 8
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import re
import sys
import time
from collections import defaultdict
from typing import Optional

import httpx

JINA_BASE = "https://r.jina.ai/https://www.pokemon-card.com/card-search/"

IMG_URL_RE = re.compile(
    r"https?://www\.pokemon-card\.com/assets/images/card_images/large/([A-Z0-9]+)/(\d{6})_[A-Z]_([A-Z0-9]+)\.jpg"
)
NAME_ALT_RE = re.compile(r"!\[Image \d+: ([^\]]+)\]\((https?://[^\)]+)\)")


async def fetch_page(client: httpx.AsyncClient, page: int, retries: int = 4) -> str:
    nonce = f"{int(time.time())}{page}{random.randint(1000, 9999)}"
    url = f"{JINA_BASE}?pg={page}&_={nonce}"
    last_err: Optional[Exception] = None
    for attempt in range(retries):
        try:
            r = await client.get(url, timeout=60)
            r.raise_for_status()
            text = r.text
            # jina の fallback 検知: pg≥2 なのに M4 だけ返ってきたら redo
            if page >= 13 and "large/M4/" in text and not any(
                slug in text for slug in ("large/SV", "large/SM", "large/M1/", "large/M2", "large/M3", "large/DP", "large/BW", "large/XY", "large/S/", "large/BAS")
            ):
                # ピュアな M4 だけのページは page 1 と同じ → fallback の可能性
                if page > 30:
                    print(f"  pg={page}: only M4 detected (likely fallback), retry attempt {attempt + 1}", file=sys.stderr)
                    await asyncio.sleep(15 + attempt * 5)
                    continue
            return text
        except (httpx.HTTPError, httpx.TimeoutException) as e:
            last_err = e
            await asyncio.sleep(2 ** attempt + random.random())
    print(f"[ERR] page {page}: {last_err}", file=sys.stderr)
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


async def fetch_all_sequential(pages: list[int], delay: float) -> list[dict]:
    results: list[dict] = []
    sets_seen: set[str] = set()
    last_distinct_page = 0

    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}) as client:
        for p in pages:
            md = await fetch_page(client, p)
            cards = parse_page(md)
            new_slugs = {c["slug"] for c in cards}
            sets_seen.update(new_slugs)
            print(
                f"  pg={p}: {len(cards)} cards, slugs=[{','.join(sorted(new_slugs))}]",
                file=sys.stderr,
            )
            results.extend(cards)
            await asyncio.sleep(delay + random.uniform(0, 1))
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
    ap.add_argument("--pages", default="1-135")
    ap.add_argument("--delay", type=float, default=6.0,
                    help="sec between requests (default 6)")
    ap.add_argument("--out", default="/tmp/pokemon_master_v2.json")
    args = ap.parse_args()

    pages = parse_pages_arg(args.pages)
    print(f"[*] fetching {len(pages)} pages sequentially with delay={args.delay}s",
          file=sys.stderr)

    cards = await fetch_all_sequential(pages, args.delay)
    print(f"[*] got {len(cards)} raw card rows", file=sys.stderr)

    by_slug = assign_card_no(cards)
    print("--- by slug ---", file=sys.stderr)
    for slug, items in sorted(by_slug.items()):
        ids = [c["global_id"] for c in items]
        print(f"  {slug}: {len(items)} cards (gid {min(ids)}-{max(ids)})",
              file=sys.stderr)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"by_slug": by_slug}, f, ensure_ascii=False, indent=2)
    print(f"[*] dumped to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())
