"""ティアワン（tier-one-onepiece.jp）スクレイパー - ONE PIECE専門

対象ブランド: onepiece
- セット一覧: トップページ `/` のアンカーから /view/category/{code} を抽出
- セット別: /view/category/{code}?page=N  (N=1,2,...)  1ページ最大48件
- 個別商品:  /view/item/{product_id}

HTML構造（`<ul class="item-list"> > <li>`）:
  <p class="item-category"><a href="/view/category/op15">OP-15 神の島の冒険</a></p>
  <p class="item-name">
    <a href="/view/item/000000006606?...">【L】レベッカ（パラレル）《OP15-039》</a>
  </p>
  <p class="price">￥1,880<span>（税込）</span></p>
  <p class="tac">在庫数:3</p>
  <img src="https://makeshop-multi-images.akamaized.net/.../000000006606_xxx.jpg"/>

item-name 正規表現: 【([^】]+)】(.+?)《([^》]+)》
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
    normalize_yuyutei_rarity,  # 同じ P-SR / P-SEC 等の表記
    parse_card_code,
)

BASE = "https://tier-one-onepiece.jp"

_NAME_RE = re.compile(r"【([^】]+)】(.+?)《([^》]+)》")
_CATEGORY_CODE_RE = re.compile(r"/view/category/([a-z0-9]+)")

# 取り扱う接頭辞（OP/ST/EB/PRB）。P-xxx プロモは別カテゴリなので別途
_ALLOWED_PREFIXES = ("op", "st", "eb", "prb")

MAX_PAGES = 10


class TieroneScraper(BaseScraper):
    source = "tierone"
    rate_interval = 2.5

    async def list_sets(self, brand: str) -> list[str]:
        if brand != "onepiece":
            return []
        html = (await self.http.get(f"{BASE}/")).text

        codes: set[str] = set()
        for m in _CATEGORY_CODE_RE.finditer(html):
            code = m.group(1)
            # 'op' 'st' 'eb' 'prb' (総合) や 'promotion' は除外。
            # 'op01'〜'op15' のように接頭辞+数字の形のみ採用
            if not any(code.startswith(p) for p in _ALLOWED_PREFIXES):
                continue
            if not re.match(r"^[a-z]+\d+$", code):
                continue
            codes.add(code.upper())
        return sorted(codes)

    async def fetch_set(self, brand: str, set_code: str) -> list[CrawledCard]:
        if brand != "onepiece":
            return []
        set_lower = set_code.lower()

        seen_ids: set[str] = set()
        cards: list[CrawledCard] = []

        for page in range(1, MAX_PAGES + 1):
            url = f"{BASE}/view/category/{set_lower}"
            if page > 1:
                url = f"{url}?page={page}"
            try:
                html = (await self.http.get(url)).text
            except Exception:
                break

            page_cards = self._parse_list(html, set_code=set_code)
            if not page_cards:
                break

            new_count = 0
            for c in page_cards:
                if c.source_card_id in seen_ids:
                    continue
                seen_ids.add(c.source_card_id)
                cards.append(c)
                new_count += 1

            # 全て既出なら次ページにも新規なしとみなして停止
            if new_count == 0:
                break
            # ページ内カード数が規定値未満なら最終ページ
            if len(page_cards) < 40:
                break

        return cards

    def _parse_list(self, html: str, *, set_code: str) -> list[CrawledCard]:
        soup = BeautifulSoup(html, "html.parser")
        ul = soup.select_one("ul.item-list")
        if not ul:
            return []

        cards: list[CrawledCard] = []
        for li in ul.find_all("li", recursive=False):
            c = self._parse_item(li, set_code)
            if c:
                cards.append(c)
        return cards

    def _parse_item(self, li, set_code: str) -> Optional[CrawledCard]:
        name_el = li.select_one("p.item-name")
        if not name_el:
            return None
        name_text = name_el.get_text(" ", strip=True)
        m = _NAME_RE.search(name_text)
        if not m:
            return None
        raw_rarity, raw_name, raw_code = m.groups()

        parsed = parse_card_code(raw_code.strip())
        if not parsed:
            return None
        parsed_set_code, card_no = parsed
        if parsed_set_code != set_code:
            # カテゴリページに混入した別セットは採用しない
            return None

        rarity, base_variant = normalize_yuyutei_rarity(raw_rarity.strip())
        variant = detect_variant_from_name(raw_name, base_variant)
        name_ja = clean_card_name(raw_name)

        price_el = li.select_one("p.price")
        price = clean_price(price_el.get_text(strip=True)) if price_el else None

        tac_el = li.select_one("p.tac")
        stock_text = tac_el.get_text(strip=True) if tac_el else ""
        stock_status = self._parse_stock(stock_text)

        # item URL / product_id
        item_link = name_el.select_one("a")
        href = item_link.get("href") if item_link else ""
        product_id_match = re.search(r"/view/item/(\d+)", href or "")
        product_id = product_id_match.group(1) if product_id_match else card_no

        img = li.select_one("div.item-list-image img") or li.select_one("img")
        image_url = img.get("src") if img else None

        source_url = f"{BASE}{href}" if href and href.startswith("/") else href

        return CrawledCard(
            brand="onepiece",
            set_code=parsed_set_code,
            card_no=card_no,
            variant=variant,
            rarity=rarity,
            name_ja=name_ja,
            source=self.source,
            source_card_id=product_id,
            source_url=source_url,
            image_url=image_url,
            price_type="sell",
            price=price,
            stock_status=stock_status,
            raw={"name_text": name_text, "stock_text": stock_text},
        )

    @staticmethod
    def _parse_stock(text: str) -> str:
        if not text:
            return "in_stock"
        m = re.search(r"在庫数[:：]\s*(\d+)", text)
        if m:
            n = int(m.group(1))
            if n == 0:
                return "out"
            return "low" if n <= 2 else "in_stock"
        if "なし" in text or "完売" in text or "×" in text:
            return "out"
        return "in_stock"
