"""価格スナップショット汚染cleanup CLI

ロジック:
  各 (source, brand) ペアについて `crawl_runs` の最新
  `scope='all' AND status='success'` の `started_at` を cutoff にする。
  各 (card_id, source) について、その source の最新スナップショットが
  対応する (source, card.brand) の cutoff より前 → 「直近の全件クロールで
  この source × brand が listing しなかった」= delisted or 旧汚染 → 削除する。

注意1: src_max ベース (source 全体の最新時刻) を使うと、hot scope cron が
  src_max を進めて非hotセットを誤削除する。必ず scope='all' の cutoff を使う。

注意2: source 単位の cutoff だと、同 source (例: fullahead) で複数 brand を
  扱うとき後発 brand の started_at が先発 brand の cutoff を上書きして
  誤削除を招く。必ず (source, brand) 単位で計算する。
  (2026-05-05 に migration 007 で crawl_runs.brand を追加して対応。
   brand=NULL の旧 row は 'onepiece' 互換として扱う)

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
        # crawl_runs から最新の (source, brand) 別 scope=all started_at を取る。
        # migration 007 未適用の場合 brand 列が無いので select に含めず取得し
        # NULL/未指定は 'onepiece' 互換として扱う (旧 row 保護)。
        try:
            runs = _get(
                client,
                "crawl_runs",
                "scope=eq.all&status=eq.success&select=source,brand,started_at&order=started_at.desc&limit=400",
            )
        except httpx.HTTPStatusError:
            # brand 列が無い (migration 未適用) → brand なしで取得
            runs = _get(
                client,
                "crawl_runs",
                "scope=eq.all&status=eq.success&select=source,started_at&order=started_at.desc&limit=400",
            )

        cutoff: dict[tuple[str, str], str] = {}
        for r in runs:
            src = r["source"]
            brand = r.get("brand") or "onepiece"  # NULL は onepiece 互換
            key = (src, brand)
            if key not in cutoff:
                cutoff[key] = r["started_at"]
        if not cutoff:
            print("[warn] no scope=all crawl_runs found", file=sys.stderr)
            return 1

        print("Per-(source, brand) cutoff (most recent scope=all start):")
        for (s, b), t in sorted(cutoff.items()):
            print(f"  {s:10s} {b:10s} {t}")

        # cards から id と brand を取る ((card_id, source) → cards.brand → cutoff判定)
        cards = []
        offset = 0
        while True:
            chunk = _get(
                client,
                "cards",
                f"select=id,brand&order=id&limit=1000&offset={offset}",
            )
            if not chunk:
                break
            cards.extend(chunk)
            if len(chunk) < 1000:
                break
            offset += 1000
        id_to_brand: dict[str, str] = {c["id"]: c["brand"] for c in cards}
        ids = list(id_to_brand.keys())

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
        skipped_no_cutoff = 0
        for (cid, src), latest in cs_max.items():
            brand = id_to_brand.get(cid)
            if not brand:
                continue
            cut = cutoff.get((src, brand))
            if cut is None:
                # その (source, brand) で scope=all crawl が未到達 → 削除しない
                skipped_no_cutoff += 1
                continue
            if latest < cut:
                to_delete.append((cid, src))

        per_src: dict[str, int] = defaultdict(int)
        for _, s in to_delete:
            per_src[s] += 1
        print(f"\nStale (card_id, source) to delete: {len(to_delete)}")
        if skipped_no_cutoff:
            print(f"  (skipped {skipped_no_cutoff} pairs: no scope=all crawl yet for that (source, brand))")
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
