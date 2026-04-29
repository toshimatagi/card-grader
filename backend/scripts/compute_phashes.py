"""image_phash 未計算のカードに pHash を埋める。

実行例（リポジトリ直下から）:
    SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python -m backend.scripts.compute_phashes
オプション:
    --brand onepiece     対象brand
    --concurrency 8      画像ダウンロード並列度
    --force              既にimage_phashがある行も上書き
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from typing import Optional

import httpx

from backend.services.phash import compute_phash_from_bytes

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


def _headers() -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


async def fetch_targets(brand: str, force: bool, page_size: int = 1000) -> list[dict]:
    select = "id,brand,set_code,card_no,image_url"
    base = f"{SUPABASE_URL}/rest/v1/cards?select={select}&brand=eq.{brand}&image_url=not.is.null&order=set_code,card_no"
    if not force:
        base += "&image_phash=is.null"

    rows: list[dict] = []
    async with httpx.AsyncClient() as client:
        offset = 0
        while True:
            url = f"{base}&limit={page_size}&offset={offset}"
            res = await client.get(url, headers=_headers(), timeout=30)
            res.raise_for_status()
            chunk = res.json()
            rows.extend(chunk)
            if len(chunk) < page_size:
                break
            offset += page_size
    return rows


async def update_phash(client: httpx.AsyncClient, card_id: str, phash: bytes) -> None:
    # bytea を hex 文字列で送ると PostgREST が \x プレフィクスを付けて解釈
    hex_str = "\\x" + phash.hex()
    res = await client.patch(
        f"{SUPABASE_URL}/rest/v1/cards?id=eq.{card_id}",
        headers={**_headers(), "Prefer": "return=minimal"},
        json={"image_phash": hex_str},
        timeout=20,
    )
    res.raise_for_status()


async def process_one(client: httpx.AsyncClient, sem: asyncio.Semaphore, card: dict) -> Optional[str]:
    async with sem:
        try:
            r = await client.get(card["image_url"], timeout=30, follow_redirects=True)
            r.raise_for_status()
            phash = compute_phash_from_bytes(r.content)
            await update_phash(client, card["id"], phash)
            return None
        except Exception as e:
            return f"{card['set_code']}-{card['card_no']}: {e}"


async def main_async(brand: str, concurrency: int, force: bool) -> int:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_KEY が未設定", file=sys.stderr)
        return 2

    print(f"Fetching cards (brand={brand}, force={force})...")
    targets = await fetch_targets(brand, force=force)
    total = len(targets)
    print(f"対象: {total}件")
    if total == 0:
        return 0

    sem = asyncio.Semaphore(concurrency)
    errors: list[str] = []
    done = 0
    async with httpx.AsyncClient(headers={"User-Agent": "card-grader-phash/1.0"}) as client:
        coros = [process_one(client, sem, c) for c in targets]
        for fut in asyncio.as_completed(coros):
            err = await fut
            done += 1
            if err:
                errors.append(err)
            if done % 50 == 0 or done == total:
                print(f"  {done}/{total} ({len(errors)} errors)")

    print(f"完了: {total - len(errors)} success / {len(errors)} errors")
    if errors:
        print("--- 先頭10件のエラー ---")
        for e in errors[:10]:
            print(f"  {e}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--brand", default="onepiece")
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    return asyncio.run(main_async(args.brand, args.concurrency, args.force))


if __name__ == "__main__":
    raise SystemExit(main())
