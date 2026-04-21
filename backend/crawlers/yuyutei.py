"""遊々亭（yuyu-tei.jp）スクレイパー

対象ブランド: onepiece (opc)
- セット一覧ページ: https://yuyu-tei.jp/top/opc
- セット別一覧:    https://yuyu-tei.jp/sell/opc/s/{set_code_lower}
- 買取:            https://yuyu-tei.jp/buy/opc/s/{set_code_lower}
- 画像CDN:         https://card.yuyu-tei.jp/opc/100_140/{set_lower}/{cid}.jpg

HTML構造（販売ページ card-product ブロック）:
  <div class="card-product ...[ sold-out]">
    <img alt="{CODE} {RARITY} {NAME}" src="{image}"/>
    <span ...>OP15-118</span>               # 型番
    <h4 class="text-primary fw-bold">エネル(パラレル)</h4>
    <strong class="d-block text-end ">9,980 円</strong>
    <label ... cart_sell_zaiko>在庫 : 2 点</label>   # or 在庫 : ×
    <input ... class="cart_cid" value="10143"/>      # 遊々亭ID
    <input ... class="cart_ver" value="op15"/>
  </div>
"""

from __future__ import annotations

import re
from typing import Optional

from bs4 import BeautifulSoup

from .base import BaseScraper, CrawledCard
from .normalizer import (
    clean_card_name,
    clean_price,
    detect_variant_from_name,
    normalize_yuyutei_rarity,
    parse_card_code,
)

BASE = "https://yuyu-tei.jp"

# OP系ブランドのセットコード一覧を取得するための接頭辞
OPC_PREFIXES = ("op", "st", "eb", "prb")

_TOP_SET_LINK_RE = re.compile(r"/sell/opc/s/([a-z0-9]+)")


class YuyuteiScraper(BaseScraper):
    source = "yuyutei"
    rate_interval = 2.5  # seconds per request

    # ------------------------------------------------------------------
    # set listing
    # ------------------------------------------------------------------
    async def list_sets(self, brand: str) -> list[str]:
        """opc トップページからセットコード一覧を取得。返却値は大文字（OP15等）。"""
        if brand != "onepiece":
            return []

        resp = await self.http.get(f"{BASE}/top/opc")
        codes: set[str] = set()
        for m in _TOP_SET_LINK_RE.finditer(resp.text):
            code = m.group(1)
            if code == "new":
                continue
            # 接頭辞が OPC_PREFIXES のどれかで始まるもののみ
            if any(code.startswith(p) for p in OPC_PREFIXES):
                codes.add(code.upper())
        # プロモカード（P-001等）は別URL "/sell/opc/s/p" で扱われる場合あり
        return sorted(codes)

    # ------------------------------------------------------------------
    # fetch set
    # ------------------------------------------------------------------
    async def fetch_set(self, brand: str, set_code: str) -> list[CrawledCard]:
        if brand != "onepiece":
            return []
        set_lower = set_code.lower()

        # 販売ページ
        sell_url = f"{BASE}/sell/opc/s/{set_lower}"
        sell_html = (await self.http.get(sell_url)).text
        sell_cards = self._parse_list(sell_html, price_type="sell", set_url=sell_url)

        # 買取ページ（構造が同じ想定。失敗しても販売データは返す）
        buy_cards: list[CrawledCard] = []
        try:
            buy_url = f"{BASE}/buy/opc/s/{set_lower}"
            buy_html = (await self.http.get(buy_url)).text
            buy_cards = self._parse_list(buy_html, price_type="buy", set_url=buy_url)
        except Exception:
            pass

        return sell_cards + buy_cards

    # ------------------------------------------------------------------
    # parser
    # ------------------------------------------------------------------
    def _parse_list(
        self, html: str, *, price_type: str, set_url: str
    ) -> list[CrawledCard]:
        soup = BeautifulSoup(html, "html.parser")
        cards: list[CrawledCard] = []

        for block in soup.select("div.card-product"):
            card = self._parse_block(block, price_type=price_type, set_url=set_url)
            if card:
                cards.append(card)
        return cards

    def _parse_block(
        self, block, *, price_type: str, set_url: str
    ) -> Optional[CrawledCard]:
        # img alt = "OP15-118 P-SEC エネル(パラレル)"
        img = block.select_one("div.product-img img") or block.select_one("img.card")
        if not img:
            return None
        alt = (img.get("alt") or "").strip()
        image_url = img.get("src")

        parts = alt.split(None, 2)
        if len(parts) < 3:
            return None
        raw_code, raw_rarity, raw_name = parts

        parsed = parse_card_code(raw_code)
        if not parsed:
            return None
        set_code, card_no = parsed

        rarity, base_variant = normalize_yuyutei_rarity(raw_rarity)
        variant = detect_variant_from_name(raw_name, base_variant)
        name_ja = clean_card_name(raw_name)

        price_el = block.select_one("strong.d-block.text-end")
        price = clean_price(price_el.get_text(strip=True)) if price_el else None

        stock_el = block.select_one("label.cart_sell_zaiko")
        stock_text = stock_el.get_text(" ", strip=True) if stock_el else ""
        stock_status = self._parse_stock(stock_text, sold_out="sold-out" in (block.get("class") or []))

        cid_el = block.select_one("input.cart_cid")
        cid = cid_el.get("value") if cid_el else None
        ver_el = block.select_one("input.cart_ver")
        ver = (ver_el.get("value") if ver_el else set_code.lower())

        source_card_id = f"{ver}/{cid}" if cid else f"{ver}/{card_no}"
        source_url = f"{BASE}/sell/opc/card/{ver}/{cid}" if cid else set_url

        return CrawledCard(
            brand="onepiece",
            set_code=set_code,
            card_no=card_no,
            variant=variant,
            rarity=rarity,
            name_ja=name_ja,
            source=self.source,
            source_card_id=source_card_id,
            source_url=source_url,
            image_url=image_url,
            price_type=price_type,
            price=price,
            stock_status=stock_status,
            raw={
                "alt": alt,
                "stock_text": stock_text,
            },
        )

    @staticmethod
    def _parse_stock(stock_text: str, sold_out: bool) -> str:
        if sold_out or "×" in stock_text:
            return "out"
        # '在庫 : 2 点' / '在庫 : ◯'
        m = re.search(r"(\d+)\s*点", stock_text)
        if m:
            n = int(m.group(1))
            return "low" if n <= 2 else "in_stock"
        if "◯" in stock_text or "○" in stock_text:
            return "in_stock"
        return "in_stock"
