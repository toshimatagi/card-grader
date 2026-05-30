"""メルカード（mercardop.jp）スクレイパー - ONE PIECE専門

cardrush-op.jp と同じ Shop-Pro 系 EC。構造も `item_data` で共通。
違い:
  - alt 属性は空、代わりに <span class="goods_name"> にテキスト
  - セット名→gid は /page/5 （パック一覧）から抽出
  - セット名→set_code のマッピングは、各 gid ページの最初のカードの型番から動的判定
"""

from __future__ import annotations

import re
from collections import defaultdict
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

BASE = "https://www.mercardop.jp"

_GOODS_RE = re.compile(r"(?:〔状態([^〕]+)〕)?(.+?)【([^】]+)】\{([^}]+)\}")
_CODE_RE = re.compile(r"\{([A-Z]+\d+-\d+)\}")

MAX_PAGES = 10


class MercardopScraper(BaseScraper):
    source = "mercardop"
    rate_interval = 2.5

    def __init__(self) -> None:
        super().__init__()
        self._set_to_gid: dict[str, int] = {}

    async def list_sets(self, brand: str) -> list[str]:
        """パック一覧ページから gid を取得し、各ページの先頭カードで set_code を判定"""
        if brand != "onepiece":
            return []

        # (1) /page/5 から gid 一覧
        try:
            html = (await self.http.get(f"{BASE}/page/5")).text
        except Exception:
            return []

        gids: list[int] = []
        for m in re.finditer(r'href="[^"]*product-group/(\d+)', html):
            gid = int(m.group(1))
            if gid not in gids and gid > 0:
                gids.append(gid)

        # (2) 各 gid ページを軽く取得し、含まれる OP/ST/EB/PRB コードから set_code を判定
        mapping: dict[str, int] = {}
        for gid in gids:
            try:
                page_html = (await self.http.get(f"{BASE}/product-group/{gid}")).text
            except Exception:
                continue
            codes = _CODE_RE.findall(page_html)
            if not codes:
                continue
            # 最頻の set_code を採用（他セット混入防止）
            counts: dict[str, int] = defaultdict(int)
            for c in codes:
                parsed = parse_card_code(c)
                if parsed:
                    counts[parsed[0]] += 1
            if not counts:
                continue
            top_set = max(counts, key=lambda k: counts[k])
            mapping.setdefault(top_set, gid)

        self._set_to_gid = mapping
        return sorted(mapping.keys())

    async def fetch_set(self, brand: str, set_code: str) -> list[CrawledCard]:
        if brand != "onepiece":
            return []
        if not self._set_to_gid:
            await self.list_sets(brand)
        gid = self._set_to_gid.get(set_code)
        if not gid:
            return []

        items: list[dict] = []
        seen_pids: set[str] = set()
        for page in range(1, MAX_PAGES + 1):
            url = f"{BASE}/product-group/{gid}"
            if page > 1:
                url = f"{url}?page={page}"
            try:
                page_items = self._parse_list((await self.http.get(url)).text, set_code)
            except Exception:
                break
            if not page_items:
                break
            new = 0
            for it in page_items:
                pid = str(it.get("product_id") or "")
                if pid and pid in seen_pids:
                    continue
                seen_pids.add(pid)
                items.append(it)
                new += 1
            if new == 0:
                break
            if len(page_items) < 60:
                break

        # condition別をグルーピング、最安を代表に
        groups: dict[tuple, list[dict]] = defaultdict(list)
        for it in items:
            groups[(it["set_code"], it["card_no"], it["variant"], it["rarity"])].append(it)

        cards: list[CrawledCard] = []
        for key, members in groups.items():
            in_stock = [m for m in members if m["price"] is not None]
            base = min(in_stock, key=lambda m: m["price"]) if in_stock else members[0]
            cards.append(CrawledCard(
                brand="onepiece",
                set_code=key[0], card_no=key[1], variant=key[2], rarity=key[3],
                name_ja=base["name_ja"],
                source=self.source,
                source_card_id=str(base["product_id"]),
                source_url=base["item_url"],
                image_url=base["image_url"],
                price_type="sell",
                price=base["price"],
                stock_status=base["stock_status"],
                raw={"conditions": [
                    {"condition": m["condition"], "price": m["price"], "stock_status": m["stock_status"], "product_id": m["product_id"]}
                    for m in members
                ]},
            ))
        return cards

    def _parse_list(self, html: str, expected_set: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        results: list[dict] = []
        for block in soup.select("div.item_data"):
            parsed = self._parse_block(block, expected_set)
            if parsed:
                results.append(parsed)
        return results

    def _parse_block(self, block, expected_set: str) -> Optional[dict]:
        pid = block.get("data-product-id")
        goods = block.select_one("span.goods_name")
        goods_text = goods.get_text(strip=True) if goods else ""
        m = _GOODS_RE.search(goods_text)
        if not m:
            return None
        condition_text, raw_name, raw_rarity, raw_code = m.groups()
        condition = condition_text.strip() if condition_text else "新品"

        parsed = parse_card_code(raw_code)
        if not parsed:
            return None
        set_code, card_no = parsed
        if set_code != expected_set:
            return None

        rarity, base_variant = normalize_yuyutei_rarity(raw_rarity)
        variant = detect_variant_from_name(raw_name, base_variant)
        name_ja = clean_card_name(raw_name)

        figure = block.select_one("span.figure")
        price = clean_price(figure.get_text(strip=True)) if figure else None

        stock_el = block.select_one("p.stock")
        stock_text = stock_el.get_text(strip=True) if stock_el else ""
        stock_status = self._parse_stock(stock_text)

        link = block.select_one("a.item_data_link")
        item_url = link.get("href") if link else None

        # 画像は async_image_box の data-src にある
        img_box = block.select_one("div.async_image_box")
        image_url = (img_box.get("data-src") if img_box else None) or ""

        return {
            "product_id": pid,
            "set_code": set_code,
            "card_no": card_no,
            "variant": variant,
            "rarity": rarity,
            "name_ja": name_ja,
            "condition": condition,
            "price": price,
            "stock_status": stock_status,
            "image_url": image_url,
            "item_url": item_url,
        }

    @staticmethod
    def _parse_stock(text: str) -> str:
        if not text or "なし" in text or "完売" in text:
            return "out"
        m = re.search(r"在庫数\s*(\d+)", text)
        if m:
            n = int(m.group(1))
            if n == 0:
                return "out"
            return "low" if n <= 2 else "in_stock"
        return "in_stock"
