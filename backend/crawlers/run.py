"""クローラー実行CLI

例:
  python -m backend.crawlers.run --source yuyutei --brand onepiece --set OP15
  python -m backend.crawlers.run --source yuyutei --brand onepiece --scope hot
  python -m backend.crawlers.run --source yuyutei --brand onepiece --scope all
  python -m backend.crawlers.run --source yuyutei --brand onepiece --set OP15 --dry-run

scope:
  all  : list_sets で取れた全セット
  hot  : 直近2セット（リスト末尾2個）
  warm : それ以外のOP/EB弾
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone

import httpx

from .base import BaseScraper, CrawledCard
from .storage import finish_run, save_crawled, start_run
from .cardrush import CardrushScraper
from .tierone import TieroneScraper
from .yuyutei import YuyuteiScraper

SCRAPERS: dict[str, type[BaseScraper]] = {
    "yuyutei": YuyuteiScraper,
    "cardrush": CardrushScraper,
    "tierone": TieroneScraper,
}


def _select_sets(all_sets: list[str], scope: str) -> list[str]:
    if not all_sets:
        return []
    if scope == "all":
        return all_sets
    if scope == "hot":
        return all_sets[-2:]  # OP14, OP15 相当
    if scope == "warm":
        return [s for s in all_sets[:-2] if s.startswith(("OP", "EB"))]
    if scope == "cold":
        return [s for s in all_sets[:-2] if not s.startswith(("OP", "EB"))]
    return all_sets


async def run(
    *, source: str, brand: str, sets: list[str], dry_run: bool, scope: str
) -> int:
    scraper_cls = SCRAPERS.get(source)
    if not scraper_cls:
        print(f"[error] unknown source: {source}", file=sys.stderr)
        return 2

    scraper = scraper_cls()
    all_collected: list[CrawledCard] = []

    run_id: int | None = None
    async with httpx.AsyncClient() as client:
        if not dry_run and os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_KEY"):
            run_id = await start_run(client, source, scope)

        try:
            if not sets:
                sets = _select_sets(await scraper.list_sets(brand), scope)
                print(f"[info] resolved sets ({scope}): {sets}")

            for set_code in sets:
                started = datetime.now(timezone.utc).isoformat()
                try:
                    cards = await scraper.fetch_set(brand, set_code)
                    all_collected.extend(cards)
                    print(f"[{source}] {set_code}: {len(cards)} records at {started}")
                except Exception as e:
                    print(f"[{source}] {set_code} failed: {e}", file=sys.stderr)
        finally:
            await scraper.aclose()

        if dry_run:
            print(f"\n[dry-run] total {len(all_collected)} records. First 5 JSON:")
            for c in all_collected[:5]:
                print(json.dumps(c.__dict__, ensure_ascii=False))
            return 0

        saved = 0
        try:
            saved = await save_crawled(all_collected)
            status = "success"
            err = None
        except Exception as e:
            status = "failed"
            err = str(e)
            print(f"[error] save failed: {e}", file=sys.stderr)

        if run_id:
            await finish_run(client, run_id, status, saved, err)

        print(f"[{source}] saved {saved} / collected {len(all_collected)} (status={status})")
        return 0 if status == "success" else 1


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--source", required=True, choices=list(SCRAPERS.keys()))
    p.add_argument("--brand", required=True)
    p.add_argument("--set", dest="sets", action="append", default=[],
                   help="セット指定（複数可 --set OP15 --set OP14）。未指定なら --scope が効く")
    p.add_argument("--scope", default="hot", choices=["all", "hot", "warm", "cold"])
    p.add_argument("--dry-run", action="store_true", help="Supabaseへ保存しない")
    args = p.parse_args()

    rc = asyncio.run(
        run(
            source=args.source,
            brand=args.brand,
            sets=[s.upper() for s in args.sets],
            dry_run=args.dry_run,
            scope=args.scope,
        )
    )
    sys.exit(rc)


if __name__ == "__main__":
    main()
