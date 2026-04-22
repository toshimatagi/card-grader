"""フルアヘッド（fullahead-onepiece-cardgame.com）スクレイパー - ONE PIECE専門

- URL: /view/category/opc-{set_lower}  (例: opc-op15, opc-st30, opc-eb04, opc-prb01)
- エンコーディング: EUC-JP (httpxが Content-Type から自動判定)
- 1ページ 48件、 ?page=N でページネーション
- itemName 形式: 【variant】型番 カード名 レアリティ [【サブ情報】]
    例:
      【スーパーパラレル】OP15-118 エネル SEC【コミック背景】
      【パラレル】OP15-001 クリーク L
      【パック】OP15-010 アルビダ C              (通常版の推定)
      【スペシャルカード】OP13-042 ...            (別セット混入あり)
"""

from __future__ import annotations

import re
from typing import Optional

from bs4 import BeautifulSoup

from .base import BaseScraper, CrawledCard
from .normalizer import (
    clean_card_name,
    clean_price,
    normalize_yuyutei_rarity,
    parse_card_code,
)

BASE = "https://fullahead-onepiece-cardgame.com"

# プレフィックス【variant】はオプショナル。通常版はプレフィックスなし。
# 型番 カード名 レアリティ [【extra】]
_NAME_RE = re.compile(
    r"^(?:【([^】]+)】\s*)?([A-Z]+\d+-\d+)\s+(.+?)\s+([A-Z/-]+)(?:\s*【([^】]+)】)?\s*$"
)

_PREFIX_TO_VARIANT: dict[str, str] = {
    "パック": "normal",
    "シングル": "normal",
    "パラレル": "parallel",
    "スーパーパラレル": "super_parallel",
    "スペシャルカード": "alt_art",
    "マンガレア": "manga",
    "プロモ": "normal",
}

MAX_PAGES = 10


def _generate_op_sets() -> list[str]:
    """OP, ST, EB, PRB の候補セットコードを列挙"""
    codes: list[str] = []
    for i in range(1, 20):
        codes.append(f"OP{i:02d}")
    for i in range(1, 31):
        codes.append(f"ST{i:02d}")
    for i in range(1, 10):
        codes.append(f"EB{i:02d}")
    for i in range(1, 5):
        codes.append(f"PRB{i:02d}")
    return codes


class FullaheadScraper(BaseScraper):
    source = "fullahead"
    rate_interval = 2.5

    async def list_sets(self, brand: str) -> list[str]:
        if brand != "onepiece":
            return []
        # トップページから /view/category/opc-xxx アンカーを抽出
        try:
            html = (await self.http.get(f"{BASE}/")).text
        except Exception:
            html = ""

        found: set[str] = set()
        for m in re.finditer(r"/view/category/opc-([a-z0-9]+)", html):
            code = m.group(1).upper()
            if re.match(r"^[A-Z]+\d+$", code):
                found.add(code)

        if found:
            return sorted(found)
        # フォールバック: 候補全セット
        return _generate_op_sets()

    async def fetch_set(self, brand: str, set_code: str) -> list[CrawledCard]:
        if brand != "onepiece":
            return []
        set_lower = set_code.lower()

        cards: list[CrawledCard] = []
        seen_keys: set[tuple] = set()
        empty_pages = 0

        for page in range(1, MAX_PAGES + 1):
            url = f"{BASE}/shopbrand/opc-{set_lower}/page{page}/recommend/"
            try:
                text = (await self.http.get(url)).text
            except Exception:
                break
            # total itemName on page (他セット混入も含む)
            total_on_page = text.count('<span class="itemName">')
            if total_on_page == 0:
                break

            page_cards = self._parse_list(text, set_code=set_code)
            new = 0
            for c in page_cards:
                key = (c.set_code, c.card_no, c.variant, c.rarity, c.source_card_id)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                cards.append(c)
                new += 1

            # 連続で新規0ページが出たら終了（最大2ページ様子見）
            if new == 0:
                empty_pages += 1
                if empty_pages >= 2:
                    break
            else:
                empty_pages = 0
            # ページに全商品数が40未満なら最終ページ
            if total_on_page < 40:
                break
        return cards

    def _parse_list(self, html: str, *, set_code: str) -> list[CrawledCard]:
        soup = BeautifulSoup(html, "html.parser")
        cards: list[CrawledCard] = []
        for name_el in soup.select("span.itemName"):
            c = self._parse_item(name_el, set_code)
            if c:
                cards.append(c)
        return cards

    def _parse_item(self, name_el, set_code: str) -> Optional[CrawledCard]:
        text = name_el.get_text(" ", strip=True)
        m = _NAME_RE.match(text)
        if not m:
            return None
        prefix, raw_code, raw_name, raw_rarity, extra = m.groups()

        parsed = parse_card_code(raw_code)
        if not parsed:
            return None
        parsed_set_code, card_no = parsed
        if parsed_set_code != set_code:
            # 他セット商品は採用しない
            return None

        rarity, base_variant = normalize_yuyutei_rarity(raw_rarity)
        # プレフィックスが既知なら variant を上書き。なしなら base_variant (normal)
        variant = _PREFIX_TO_VARIANT.get(prefix.strip(), base_variant) if prefix else base_variant
        name_ja = clean_card_name(raw_name)

        # 親の <a> から product_id、itemPrice、M_item-stock-smallstock を辿る
        a = name_el.find_parent("a")
        item_url = a.get("href") if a else None
        product_id: Optional[str] = None
        if item_url:
            pid_m = re.search(r"/shopdetail/(\d+)", item_url)
            if pid_m:
                product_id = pid_m.group(1)

        # 同じ親コンテナ (a の親 div) 配下に itemPrice がある
        container = a.parent if a else name_el.parent
        price_el = container.select_one("span.itemPrice strong") if container else None
        price = clean_price(price_el.get_text(strip=True)) if price_el else None

        stock_el = container.select_one("span.M_item-stock-smallstock") if container else None
        stock_text = stock_el.get_text(strip=True) if stock_el else ""
        stock_status = self._parse_stock(stock_text)

        img = container.select_one("span.itemImg img") if container else None
        image_url = img.get("src") if img else None

        source_url = f"{BASE}{item_url}" if item_url and item_url.startswith("/") else item_url

        return CrawledCard(
            brand="onepiece",
            set_code=parsed_set_code,
            card_no=card_no,
            variant=variant,
            rarity=rarity,
            name_ja=name_ja,
            source=self.source,
            source_card_id=product_id or f"{parsed_set_code}-{card_no}-{variant}-{rarity}",
            source_url=source_url,
            image_url=image_url,
            price_type="sell",
            price=price,
            stock_status=stock_status,
            raw={"name_text": text, "stock_text": stock_text, "extra": extra},
        )

    @staticmethod
    def _parse_stock(text: str) -> str:
        if not text:
            return "in_stock"
        if "売切" in text or "完売" in text or "なし" in text or "0点" in text:
            return "out"
        m = re.search(r"(\d+)", text)
        if m:
            n = int(m.group(1))
            if n == 0:
                return "out"
            return "low" if n <= 2 else "in_stock"
        return "in_stock"
