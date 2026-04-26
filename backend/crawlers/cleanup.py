"""価格スナップショット汚染cleanup CLI

ロジック:
  各 source について `crawl_runs` の最新 `scope='all' AND status='success'` の
  `started_at` を cutoff にする。各 (card_id, source) について、その source の
  最新スナップショットが cutoff より前 → 「直近の全件クロールでこのカードを
  source が listing しなかった」= delisted or 旧汚染 → 削除する。

注意: src_max ベース (source 全体の最新時刻) を使うと、hot scope cron が
  src_max を進めて非hotセットを誤削除する。必ず scope='all' の cutoff を使う。

Usage:
  python -m backend.crawlers.cleanup           # dry-run
  python -m backend.crawlers.cleanup --execute # 実削除
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from typing import Optional

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


def _headers() -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


def _get(client: httpx.Client, path: str, params: str = "") -> list:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url = f"{url}?{params}"
    resp = client.get(url, headers=_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


def _delete(client: httpx.Client, params: str) -> int:
    url = f"{SUPABASE_URL}/rest/v1/price_snapshots?{params}"
    resp = client.delete(
        url,
        headers={**_headers(), "Prefer": "return=representation"},
        timeout=60,
    )
    resp.raise_for_status()
    return len(resp.json())


def run(execute: bool = False) -> int:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[error] SUPABASE_URL / SUPABASE_SERVICE_KEY 未設定", file=sys.stderr)
        return 2

    with httpx.Client() as client:
        runs = _get(
            client,
            "crawl_runs",
            "scope=eq.all&status=eq.success&select=source,started_at&order=started_at.desc&limit=200",
        )
        cutoff: dict[str, str] = {}
        for r in runs:
            src = r["source"]
            if src not in cutoff:
                cutoff[src] = r["started_at"]
        if not cutoff:
            print("[warn] no scope=all crawl_runs found", file=sys.stderr)
            return 1

        print("Per-source cutoff (most recent scope=all start):")
        for s, t in sorted(cutoff.items()):
            print(f"  {s:10s} {t}")

        cards = []
        offset = 0
        while True:
            chunk = _get(
                client,
                "cards",
                f"select=id&order=id&limit=1000&offset={offset}",
            )
            if not chunk:
                break
            cards.extend(chunk)
            if len(chunk) < 1000:
                break
            offset += 1000
        ids = [c["id"] for c in cards]

        snaps = []
        for i in range(0, len(ids), 100):
            chunk = _get(
                client,
                "price_snapshots",
                f"card_id=in.({','.join(ids[i:i+100])})&select=card_id,source,captured_at&limit=200000",
            )
            snaps.extend(chunk)

        cs_max: dict[tuple, str] = defaultdict(str)
        for s in snaps:
            k = (s["card_id"], s["source"])
            if s["captured_at"] > cs_max[k]:
                cs_max[k] = s["captured_at"]

        to_delete: list[tuple[str, str]] = []
        for (cid, src), latest in cs_max.items():
            if src not in cutoff:
                continue
            if latest < cutoff[src]:
                to_delete.append((cid, src))

        per_src: dict[str, int] = defaultdict(int)
        for _, s in to_delete:
            per_src[s] += 1
        print(f"\nStale (card_id, source) to delete: {len(to_delete)}")
        for s, n in sorted(per_src.items()):
            print(f"  {s:10s} {n}")

        if not execute:
            print("\n[dry-run] use --execute to actually delete")
            return 0

        deleted = 0
        for cid, src in to_delete:
            try:
                deleted += _delete(client, f"card_id=eq.{cid}&source=eq.{src}")
            except Exception as e:
                print(f"[error] delete {cid[:8]}/{src} failed: {e}", file=sys.stderr)
        print(f"\nDeleted {deleted} snapshots")
        return 0


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--execute", action="store_true", help="実削除する (省略時はdry-run)")
    args = p.parse_args()
    sys.exit(run(execute=args.execute))


if __name__ == "__main__":
    main()
