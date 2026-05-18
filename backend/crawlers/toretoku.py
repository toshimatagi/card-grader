"""トレトク（kaitori-toretoku.jp）スクレイパー - 買取価格

URL:
  - https://kaitori-toretoku.jp/onepiece  (ワンピ 買取価格ランキング)
  - https://kaitori-toretoku.jp/pokemon   (ポケカ 買取価格ランキング、2026-05-19 追加)
    各ページ1リクエストで全カード ~300件が data-* 属性で埋め込まれている

HTML 形式:
  <li data-name="モンキー・D・ルフィ (パラレル) OP01-003 L"
      data-price="13100"
      data-modelNumber="OP01-003"
      data-rarity="L"
      data-pack="ROMANCE DAWN（OP-01）">
    <img src="...">
  </li>

ポケカは data-modelnumber が "S1H 068/060" / "M2a 197/190" / "SV9a 084/060" のような
"{SET} {番号}/{総数}" 形式。set_code を yuyutei/fullahead 互換にゼロ埋め正規化、
card_no は スラッシュ前の数字 3桁にする。

robots.txt: User-agent: *  Disallow: /wp-admin/  → クロール許可

価格種別: buy のみ（販売価格はない、買取査定額）
"""

from __future__ import annotations

import re
from typing import Optional

from bs4 import BeautifulSoup

from .base import BaseScraper, CrawledCard
from .normalizer import (
    clean_card_name,
    detect_variant_from_name,
    normalize_pokemon_rarity,
    normalize_yuyutei_rarity,
    parse_card_code,
)

BASE = "https://kaitori-toretoku.jp"

# ポケカ data-modelnumber 形式: "S1H 068/060", "M2a 197/190", "旧1 No.006"
# 現代カード (M/SV/S系) のみ拾う
_PKM_CODE_RE = re.compile(r"^([A-Za-z]+\d+[A-Za-z]?)\s+0*(\d+)\s*/\s*\d+\s*$")


# DB に格納される現役の set prefix のみ収集対象 (旧 S/SM/ADV/PCG/E/neo 等は対象外)
_SUPPORTED_PKM_PREFIXES = {"M", "SV"}


def _normalize_pkm_set_code(raw: str) -> Optional[str]:
    """toretoku 表記の pokemon set_code を DB 形式に正規化。

    DB の prefix 別ルール:
      M  シリーズ → 数字部分を 2桁ゼロ埋め (M2A → M02A, M4 → M04)
      SV シリーズ → ゼロ埋めなし (SV9 → SV9, SV9A → SV9A, SV11B → SV11B)

    DB に該当 prefix がないカード (S, ADV, PCG, MC, neo 等) は None を返す。
    """
    raw = raw.strip().upper()
    m = re.match(r"^([A-Z]+)(\d+)([A-Z]?)$", raw)
    if not m:
        return None
    prefix, num, suffix = m.groups()
    if prefix not in _SUPPORTED_PKM_PREFIXES:
        return None
    if prefix == "M" and len(num) == 1:
        num = num.zfill(2)
    return f"{prefix}{num}{suffix}"


def _parse_pkm_modelnumber(raw_code: str) -> Optional[tuple[str, str]]:
    """ポケカ data-modelnumber から (set_code, card_no) を抽出。
    旧弾形式 (旧1 No.006)、PROMO、対象外 prefix (S, ADV, PCG等) は None。
    """
    m = _PKM_CODE_RE.match(raw_code)
    if not m:
        return None
    raw_set, raw_no = m.groups()
    set_code = _normalize_pkm_set_code(raw_set)
    if set_code is None:
        return None
    card_no = raw_no.zfill(3)
    return set_code, card_no


class ToretokuScraper(BaseScraper):
    source = "toretoku"
    rate_interval = 5.0  # WordPress、低レート尊重

    BRAND_URL = {
        "onepiece": "/onepiece",
        "pokemon": "/pokemon",
    }

    def __init__(self) -> None:
        super().__init__()
        self._cache: dict[str, list[CrawledCard]] = {}

    async def _load(self, brand: str) -> None:
        """対象ブランドのページを1リクエストで全件取得しキャッシュ"""
        if brand in self._cache:
            return
        url_path = self.BRAND_URL.get(brand)
        if not url_path:
            self._cache[brand] = []
            return
        try:
            html = (await self.http.get(f"{BASE}{url_path}")).text
        except Exception:
            self._cache[brand] = []
            return

        soup = BeautifulSoup(html, "html.parser")
        items = soup.find_all("li", attrs={"data-modelnumber": True})

        cards: list[CrawledCard] = []
        for li in items:
            card = self._parse_li(li, brand=brand)
            if card:
                cards.append(card)
        self._cache[brand] = cards

    def _parse_li(self, li, *, brand: str) -> Optional[CrawledCard]:
        raw_code = (li.get("data-modelnumber") or "").strip()
        raw_name = (li.get("data-name") or "").strip()
        raw_rarity = (li.get("data-rarity") or "").strip().upper()
        price_str = (li.get("data-price") or "").strip()
        try:
            price = int(price_str) if price_str else None
        except ValueError:
            price = None

        if brand == "pokemon":
            parsed = _parse_pkm_modelnumber(raw_code)
            if not parsed:
                return None  # 旧弾形式 (旧1 No.006) や PROMO は対応外
            set_code, card_no = parsed
            rarity, base_variant = normalize_pokemon_rarity(raw_rarity)
            variant = detect_variant_from_name(raw_name, base_variant)
        else:
            # onepiece (既存ロジック)
            parsed = parse_card_code(raw_code)
            if not parsed:
                return None
            set_code, card_no = parsed
            rarity, base_variant = normalize_yuyutei_rarity(raw_rarity)
            variant = detect_variant_from_name(raw_name, base_variant)

        # 名前抽出: data-name から末尾の「型番 レアリティ」を除いた部分
        name_only = re.sub(
            rf"\s*{re.escape(raw_code)}\s+{re.escape(raw_rarity)}\s*$",
            "",
            raw_name,
        ).strip()
        name_ja = clean_card_name(name_only) or raw_name

        img = li.find("img")
        image_url = img.get("src") if img else None

        return CrawledCard(
            brand=brand,
            set_code=set_code,
            card_no=card_no,
            variant=variant,
            rarity=rarity,
            name_ja=name_ja,
            source=self.source,
            source_card_id=f"{set_code}-{card_no}-{variant}-{rarity}",
            source_url=f"{BASE}{self.BRAND_URL[brand]}",
            image_url=image_url,
            price_type="buy",
            price=price,
            stock_status=None,
            raw={
                "data_name": raw_name,
                "data_modelnumber": raw_code,
                "data_pack": li.get("data-pack"),
                "data_date": li.get("data-date"),
                "data_language": li.get("data-language"),
            },
        )

    async def list_sets(self, brand: str) -> list[str]:
        if brand not in self.BRAND_URL:
            return []
        await self._load(brand)
        return sorted({c.set_code for c in self._cache.get(brand, [])})

    async def fetch_set(self, brand: str, set_code: str) -> list[CrawledCard]:
        if brand not in self.BRAND_URL:
            return []
        await self._load(brand)
        return [c for c in self._cache.get(brand, []) if c.set_code == set_code]
