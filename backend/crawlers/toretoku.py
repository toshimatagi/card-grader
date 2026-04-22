"""トレトク（kaitori-toretoku.jp）スクレイパー - ONE PIECE 買取価格

URL:
  - https://kaitori-toretoku.jp/onepiece  (買取価格ランキング全リスト)
    1ページに全セットの高額カード ~350件が data-* 属性で埋め込まれている

HTML:
  <li data-name="モンキー・D・ルフィ (パラレル) OP01-003 L"
      data-price="13100"
      data-modelNumber="OP01-003"
      data-rarity="L"
      data-pack="ROMANCE DAWN（OP-01）">
    <img src="...">
    ...
  </li>

価格種別: buy のみ（販売価格はない）
"""

from __future__ import annotations

import re
from typing import Optional

from bs4 import BeautifulSoup

from .base import BaseScraper, CrawledCard
from .normalizer import (
    clean_card_name,
    detect_variant_from_name,
    normalize_yuyutei_rarity,
    parse_card_code,
)

BASE = "https://kaitori-toretoku.jp"


class ToretokuScraper(BaseScraper):
    source = "toretoku"
    rate_interval = 5.0  # WordPress、低レート尊重

    def __init__(self) -> None:
        super().__init__()
        self._cache: list[CrawledCard] = []

    async def _load_all(self) -> None:
        """1リクエストで全カード取得しキャッシュ"""
        if self._cache:
            return
        try:
            html = (await self.http.get(f"{BASE}/onepiece")).text
        except Exception:
            return

        soup = BeautifulSoup(html, "html.parser")
        items = soup.find_all("li", attrs={"data-modelnumber": True})

        for li in items:
            card = self._parse_li(li)
            if card:
                self._cache.append(card)

    def _parse_li(self, li) -> Optional[CrawledCard]:
        raw_code = (li.get("data-modelnumber") or "").strip()
        parsed = parse_card_code(raw_code)
        if not parsed:
            return None
        set_code, card_no = parsed

        raw_name = (li.get("data-name") or "").strip()
        raw_rarity = (li.get("data-rarity") or "").strip().upper()
        price_str = (li.get("data-price") or "").strip()
        try:
            price = int(price_str) if price_str else None
        except ValueError:
            price = None

        rarity, base_variant = normalize_yuyutei_rarity(raw_rarity)
        # data-name から (パラレル) などを検出
        variant = detect_variant_from_name(raw_name, base_variant)
        # 名前抽出: data-name から末尾の「型番 レアリティ」を除いた部分
        name_only = re.sub(rf"\s*{re.escape(raw_code)}\s+{re.escape(raw_rarity)}\s*$", "", raw_name).strip()
        name_ja = clean_card_name(name_only) or raw_name

        img = li.find("img")
        image_url = img.get("src") if img else None

        return CrawledCard(
            brand="onepiece",
            set_code=set_code,
            card_no=card_no,
            variant=variant,
            rarity=rarity,
            name_ja=name_ja,
            source=self.source,
            source_card_id=f"{set_code}-{card_no}-{variant}-{rarity}",
            source_url=f"{BASE}/onepiece",
            image_url=image_url,
            price_type="buy",
            price=price,
            stock_status=None,
            raw={
                "data_name": raw_name,
                "data_pack": li.get("data-pack"),
                "data_date": li.get("data-date"),
                "data_language": li.get("data-language"),
            },
        )

    async def list_sets(self, brand: str) -> list[str]:
        if brand != "onepiece":
            return []
        await self._load_all()
        return sorted({c.set_code for c in self._cache})

    async def fetch_set(self, brand: str, set_code: str) -> list[CrawledCard]:
        if brand != "onepiece":
            return []
        await self._load_all()
        return [c for c in self._cache if c.set_code == set_code]
