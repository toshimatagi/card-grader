"""遊々亭（yuyu-tei.jp）スクレイパー

対象ブランド: onepiece (opc), pokemon (poc)
- セット一覧ページ: https://yuyu-tei.jp/top/{category}
- セット別販売:    https://yuyu-tei.jp/sell/{category}/s/{set_code_lower}
- 買取:            https://yuyu-tei.jp/buy/{category}/s/{set_code_lower}

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
    normalize_pokemon_rarity,
    normalize_yuyutei_rarity,
    parse_card_code,
)

BASE = "https://yuyu-tei.jp"

# ブランド → 遊々亭カテゴリパス
_BRAND_CATEGORY = {
    "onepiece": "opc",
    "pokemon": "poc",
}

# OP系ブランドのセットコード接頭辞 (poc には適用しない)
OPC_PREFIXES = ("op", "st", "eb", "prb")


def _top_set_link_re(category: str) -> re.Pattern[str]:
    return re.compile(rf"/sell/{category}/s/([a-z0-9]+)")


class YuyuteiScraper(BaseScraper):
    source = "yuyutei"
    rate_interval = 2.5  # seconds per request

    # ------------------------------------------------------------------
    # set listing
    # ------------------------------------------------------------------
    async def list_sets(self, brand: str) -> list[str]:
        """各ブランドのトップページからセットコード一覧を取得。返却値は大文字。"""
        category = _BRAND_CATEGORY.get(brand)
        if not category:
            return []

        resp = await self.http.get(f"{BASE}/top/{category}")
        codes: set[str] = set()
        for m in _top_set_link_re(category).finditer(resp.text):
            code = m.group(1)
            if code == "new":
                continue
            # OP は接頭辞フィルタ。ポケカは命名が多様 (bw/xy/sm/s/sv/m...) のため
            # /sell/poc/s/ 配下に出てくるすべてを採用する。
            if brand == "onepiece" and not any(code.startswith(p) for p in OPC_PREFIXES):
                continue
            codes.add(code.upper())
        return sorted(codes)

    # ------------------------------------------------------------------
    # fetch set
    # ------------------------------------------------------------------
    async def fetch_set(self, brand: str, set_code: str) -> list[CrawledCard]:
        category = _BRAND_CATEGORY.get(brand)
        if not category:
            return []
        set_lower = set_code.lower()

        # 販売ページ
        sell_url = f"{BASE}/sell/{category}/s/{set_lower}"
        sell_html = (await self.http.get(sell_url)).text
        sell_cards = self._parse_list(sell_html, brand=brand, price_type="sell", set_url=sell_url)

        # 買取ページ（構造が同じ想定。失敗しても販売データは返す）
        buy_cards: list[CrawledCard] = []
        try:
            buy_url = f"{BASE}/buy/{category}/s/{set_lower}"
            buy_html = (await self.http.get(buy_url)).text
            buy_cards = self._parse_list(buy_html, brand=brand, price_type="buy", set_url=buy_url)
        except Exception:
            pass

        return sell_cards + buy_cards

    # ------------------------------------------------------------------
    # parser
    # ------------------------------------------------------------------
    def _parse_list(
        self, html: str, *, brand: str, price_type: str, set_url: str
    ) -> list[CrawledCard]:
        soup = BeautifulSoup(html, "html.parser")
        cards: list[CrawledCard] = []

        for block in soup.select("div.card-product"):
            card = self._parse_block(block, brand=brand, price_type=price_type, set_url=set_url)
            if card:
                cards.append(card)
        return cards

    def _parse_block(
        self, block, *, brand: str, price_type: str, set_url: str
    ) -> Optional[CrawledCard]:
        # img alt の形式はブランド毎に異なる
        #   onepiece: "OP15-118 P-SEC エネル(パラレル)"  (set_code はaltに含まれる)
        #   pokemon : "120/083 MUR メガゲッコウガex"    (set_code は cart_ver から取得)
        img = block.select_one("div.product-img img") or block.select_one("img.card")
        if not img:
            return None
        alt = (img.get("alt") or "").strip()
        image_url = img.get("src")

        parts = alt.split(None, 2)
        if len(parts) < 3:
            return None

        cid_el = block.select_one("input.cart_cid")
        cid = cid_el.get("value") if cid_el else None
        ver_el = block.select_one("input.cart_ver")
        ver = ver_el.get("value") if ver_el else None

        if brand == "pokemon":
            raw_no, raw_rarity, raw_name = parts
            # 分子部分 (例: '120/083' → '120') を取る。ゼロ埋め3桁に正規化
            num_str = raw_no.split("/", 1)[0].strip()
            if not num_str.isdigit():
                return None
            card_no = num_str.zfill(3)
            # set_code は cart_ver から取って大文字化 (例: m04 → M04)
            if not ver:
                return None
            set_code = ver.upper()
            rarity, base_variant = normalize_pokemon_rarity(raw_rarity)
            variant = base_variant
            name_ja = raw_name.strip()
        else:
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

        ver_for_url = ver if ver else set_code.lower()
        category = _BRAND_CATEGORY.get(brand, "opc")
        source_card_id = f"{ver_for_url}/{cid}" if cid else f"{ver_for_url}/{card_no}"
        source_url = f"{BASE}/sell/{category}/card/{ver_for_url}/{cid}" if cid else set_url

        return CrawledCard(
            brand=brand,
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
