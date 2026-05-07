"""pokemon-card.com 詳細ページ (1カード=1URL) を直接 sweep して
過去2年分セットのマスターを取得。

jina.ai のページネーションは不安定 (rate limit + キャッシュ衝突)
なので /card-search/details.php/card/{global_id}/regu/all を直接叩く。
詳細ページは set_slug, card_no/total, name, rarity を確実に返す。

Probe で確認した global_id の概算分布 (2026-05-06):
  - SV7 系:   ~046000
  - SV11/M:   ~048000-050200
  - 古い再録: 047xxx-050xxx も混在 (XY/MC/WCS 等)

使い方:
  python -m backend.scripts.fetch_pokemon_master_v3 --start 48000 --end 50500 --delay 4
  python -m backend.scripts.fetch_pokemon_master_v3 --start 46000 --end 50500 --delay 5 --resume
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

JINA_BASE = "https://r.jina.ai/https://www.pokemon-card.com/card-search/details.php/card/"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# pokemon-card.com slug → 当 DB の set_code
PCC_SLUG_TO_SET_CODE: dict[str, str] = {
    "M1": "M01", "M1L": "M01L", "M1S": "M01S",
    "M1A": "M01A", "M1B": "M01B",
    "M2": "M02", "M2A": "M02A", "M2B": "M02B",
    "M3": "M03", "M3A": "M03A",
    "M4": "M04", "M4A": "M04A",
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
    "SV11": "SV11", "SV11W": "SV11W", "SV11B": "SV11B",
    "SVP": "SVP",  # プロモ
}

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
    "SV11", "SV11W", "SV11B",
}

# 詳細ページのHTML/markdown から抽出する正規表現
TITLE_RE = re.compile(r"^# ([^\n]+)$", re.MULTILINE)
# pokemon-card.com は SV4a, SV6a, SV7p のように subset を小文字 a/p/etc で表現するため
# 正規表現は [A-Za-z0-9]+ にして、parse 後に upper() で正規化する
SET_SLUG_RE = re.compile(
    r"/assets/images/card/regulation_logo_1/([A-Za-z0-9]+)\.gif"
)
CARD_NO_RE = re.compile(r"\]?(\d{1,3})/(\d{1,3})!\[")
RARITY_RE = re.compile(r"/assets/images/card/rarity/ic_rare_([a-z0-9_]+)\.gif")
IMG_URL_RE = re.compile(
    r"https?://www\.pokemon-card\.com/assets/images/card_images/large/[A-Za-z0-9]+/(\d{6})_[A-Z]_[A-Za-z0-9]+\.jpg"
)


def parse_detail(text: str) -> Optional[dict]:
    """詳細ページの markdown から (slug, card_no, total, name, rarity, image) を抽出"""
    title_m = TITLE_RE.search(text)
    name = title_m.group(1).strip() if title_m else None
    if name:
        # markdown の H1 は "ビードル | ポケモンカードゲーム公式ホームページ"
        # の形式なので " | " 以降を切る
        name = name.split(" | ")[0].strip()

    slug_m = SET_SLUG_RE.search(text)
    if not slug_m:
        return None
    slug = slug_m.group(1).upper()  # SV4a → SV4A 等で大文字統一

    no_m = CARD_NO_RE.search(text)
    if not no_m:
        return None
    card_no = no_m.group(1).zfill(3)
    total = int(no_m.group(2))

    rar_m = RARITY_RE.search(text)
    rarity = rar_m.group(1) if rar_m else "UNKNOWN"

    img_m = IMG_URL_RE.search(text)
    image_url = img_m.group(0) if img_m else None

    if not name:
        return None

    return {
        "slug": slug,
        "card_no": card_no,
        "total": total,
        "name_ja": name,
        "rarity": _normalize_rarity(rarity),
        "image_url": image_url,
    }


def _normalize_rarity(raw: str) -> str:
    """rarity_logo の slug を当DB標準のレア度文字列に正規化"""
    raw = raw.lower()
    # 新形式 (SV-era 以降): ic_rare_s_2 (SAR), ic_rare_s_1 (SR), ic_rare_a_1/_2 (AR/SAR)
    # 旧形式: ic_rare_c_c, _c_uc, _c_r, _c_rr, _c_rrr, _c_sr, _c_sar, _c_ur, _c_chr,
    #         _c_ar, _c_aceSpec
    # 末尾の _数字 / _文字 で識別
    if raw.endswith("_sar"):
        return "SAR"
    if raw.endswith("_ar"):
        return "AR"
    if raw.endswith("_ur"):
        return "UR"
    if raw.endswith("_sr"):
        return "SR"
    if raw.endswith("_rrr"):
        return "RRR"
    if raw.endswith("_rr"):
        return "RR"
    if raw.endswith("_chr"):
        return "CHR"
    if "acespec" in raw:
        return "ACE"
    # 新形式 ic_rare_s_2 系 — s_数字 / a_数字 で SR/SAR/AR を識別
    if raw in ("s_2", "s_3") or raw.endswith("_s_2") or raw.endswith("_s_3"):
        return "SAR"
    if raw == "s_1" or raw.endswith("_s_1"):
        return "SR"
    if raw in ("a_1", "a_2") or raw.endswith("_a_1") or raw.endswith("_a_2"):
        return "AR"
    if raw.endswith("_r"):
        return "R"
    if raw.endswith("_uc"):
        return "U"
    if raw.endswith("_c_c") or raw.endswith("_c"):
        return "C"
    if raw.endswith("_p"):
        return "P"
    return raw.upper()


async def fetch_card(client: httpx.AsyncClient, gid: int) -> Optional[dict]:
    nonce = f"{int(time.time())}{gid}{random.randint(100, 999)}"
    url = f"{JINA_BASE}{gid}/regu/all?_={nonce}"
    for attempt in range(3):
        try:
            r = await client.get(url, timeout=30)
            r.raise_for_status()
            return parse_detail(r.text)
        except (httpx.HTTPError, httpx.TimeoutException):
            if attempt < 2:
                await asyncio.sleep(3 + attempt * 2)
    return None


async def upsert_to_supabase(rows: list[dict]) -> int:
    if not rows or not SUPABASE_URL or not SUPABASE_KEY:
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


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, required=True, help="global_id 起点")
    ap.add_argument("--end", type=int, required=True, help="global_id 終点 (含む)")
    ap.add_argument("--delay", type=float, default=4.0)
    ap.add_argument("--past-2years-only", action="store_true",
                    help="DB 投入対象を過去2年分セットに限定")
    ap.add_argument("--out", default="/tmp/pokemon_master_v3.json")
    ap.add_argument("--resume", action="store_true",
                    help="--out の既存JSONをロードしてから続行")
    ap.add_argument("--no-upsert", action="store_true",
                    help="DB upsert をスキップ (JSONのみ)")
    args = ap.parse_args()

    # resume 時は既存データロード
    by_gid: dict[int, dict] = {}
    if args.resume and os.path.exists(args.out):
        with open(args.out, encoding="utf-8") as f:
            existing = json.load(f).get("by_gid", {})
            by_gid = {int(k): v for k, v in existing.items()}
        print(f"[*] resumed with {len(by_gid)} existing entries", file=sys.stderr)

    target_gids = [g for g in range(args.start, args.end + 1) if g not in by_gid]
    print(f"[*] sweeping {len(target_gids)} gids ({args.start}-{args.end}) "
          f"with delay={args.delay}s", file=sys.stderr)

    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}) as client:
        for i, gid in enumerate(target_gids, 1):
            data = await fetch_card(client, gid)
            if data:
                by_gid[gid] = {**data, "global_id": gid}
                print(
                    f"[{i}/{len(target_gids)}] gid={gid} "
                    f"{data['slug']}-{data['card_no']} {data['name_ja']} "
                    f"({data['rarity']})",
                    file=sys.stderr,
                )
            else:
                # Rate-limit や 404 で None
                print(f"[{i}/{len(target_gids)}] gid={gid} skip", file=sys.stderr)

            # 30件ごとに JSON dump (耐障害)
            if i % 30 == 0:
                with open(args.out, "w", encoding="utf-8") as f:
                    json.dump({"by_gid": by_gid}, f, ensure_ascii=False, indent=2)

            await asyncio.sleep(args.delay + random.uniform(0, 1))

    # 最終 dump
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"by_gid": by_gid}, f, ensure_ascii=False, indent=2)
    print(f"[*] final dump: {args.out} ({len(by_gid)} entries)", file=sys.stderr)

    # DB 投入
    if args.no_upsert:
        return

    rows = []
    for gid, c in by_gid.items():
        set_code = PCC_SLUG_TO_SET_CODE.get(c["slug"])
        if not set_code:
            continue
        if args.past_2years_only and set_code not in PAST_2YEARS_CODES:
            continue
        rows.append({
            "brand": "pokemon",
            "set_code": set_code,
            "card_no": c["card_no"],
            "variant": "normal",
            "rarity": c.get("rarity", "UNKNOWN"),
            "name_ja": c["name_ja"],
            "image_url": c.get("image_url"),
        })

    print(f"[*] upserting {len(rows)} rows to Supabase", file=sys.stderr)
    inserted = await upsert_to_supabase(rows)
    print(f"[*] upserted {inserted} rows", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())
