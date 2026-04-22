"""カードラッシュ（cardrush-op.jp）スクレイパー - ONE PIECE専用サイト

対象ブランド: onepiece (opc)
- トップ: https://www.cardrush-op.jp/
- セット一覧: https://www.cardrush-op.jp/product-group/{gid}

トップページのアンカーから set_code → gid のマップを動的に作る。
同じ型番でも状態ランク（A-, A, B...）ごとに別商品になるため、
最安価格を代表値として採用する（raw に全件残す）。

HTML構造:
  <div class="item_data" data-product-id="12850">
    <img alt="〔状態A-〕ラブーン【UC】{OP15-035}"/>
    <span class="figure">160円</span>
    <p class="stock">在庫数 34枚</p>  or  在庫なし
  </div>

alt 正規表現: (状態プレフィックスはオプション) "〔状態X〕カード名【レアリティ】｛型番｝"
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
    normalize_yuyutei_rarity,  # 遊々亭と同じ表記体系（P-SEC等）
    parse_card_code,
)

BASE = "https://www.cardrush-op.jp"

_ALT_RE = re.compile(r"(?:〔状態([^〕]+)〕)?(.+?)【([^】]+)】\{([^}]+)\}")  # noqa: W605

MAX_PAGES = 10  # 1ページ=100件、10ページ=1000件まで


# トップのアンカーテキストから set_code を抽出: "【OP-15】" or "【ST-30】" or "【P】"
_LABEL_SET_RE = re.compile(r"【([A-Z]+)[-]?(\d{0,2})】")


class CardrushScraper(BaseScraper):
    source = "cardrush"
    rate_interval = 2.5

    def __init__(self) -> None:
        super().__init__()
        self._set_to_gid: dict[str, int] = {}

    # ------------------------------------------------------------------
    # set listing : トップページから set_code → gid を抽出
    # ------------------------------------------------------------------
    async def list_sets(self, brand: str) -> list[str]:
        if brand != "onepiece":
            return []
        html = (await self.http.get(f"{BASE}/")).text
        soup = BeautifulSoup(html, "html.parser")

        mapping: dict[str, int] = {}
        for a in soup.find_all("a", href=re.compile(r"/product-group/\d+")):
            m_href = re.search(r"/product-group/(\d+)", a.get("href", ""))
            if not m_href:
                continue
            gid = int(m_href.group(1))
            text = a.get_text(" ", strip=True)
            # 例: 'ブースターパック 神の島の冒険【OP-15】', 'プレミアムブースター ...【PRB-02】'
            m = _LABEL_SET_RE.search(text)
            if not m:
                continue
            prefix, num = m.groups()
            if not num:
                # 【P】等: プロモは扱いが複雑なのでスキップ
                continue
            set_code = f"{prefix}{num}"
            # 最初に見つけたものを優先（"もっと見る"リンクは最後に出る）
            mapping.setdefault(set_code, gid)

        self._set_to_gid = mapping
        return sorted(mapping.keys())

    # ------------------------------------------------------------------
    # fetch set
    # ------------------------------------------------------------------
    async def fetch_set(self, brand: str, set_code: str) -> list[CrawledCard]:
        if brand != "onepiece":
            return []
        if not self._set_to_gid:
            await self.list_sets(brand)

        gid = self._set_to_gid.get(set_code)
        if not gid:
            return []

        # ページネーション対応: 1ページ=100件、product_idで重複除去
        items: list[dict] = []
        seen_pids: set[str] = set()
        for page in range(1, MAX_PAGES + 1):
            url = f"{BASE}/product-group/{gid}"
            if page > 1:
                url = f"{url}?page={page}"
            try:
                page_items = self._parse_list((await self.http.get(url)).text, set_url=url)
            except Exception:
                break
            if not page_items:
                break
            new_count = 0
            for it in page_items:
                pid = str(it.get("product_id") or "")
                if pid and pid in seen_pids:
                    continue
                seen_pids.add(pid)
                items.append(it)
                new_count += 1
            if new_count == 0:
                break
            if len(page_items) < 100:
                break

        # 同じ (set_code, card_no, variant, rarity) でグルーピングして最安を採用
        groups: dict[tuple, list[dict]] = defaultdict(list)
        for it in items:
            key = (it["set_code"], it["card_no"], it["variant"], it["rarity"])
            groups[key].append(it)

        cards: list[CrawledCard] = []
        for key, members in groups.items():
            # 価格がある中の最安を代表に
            in_stock = [m for m in members if m["price"] is not None]
            base = min(in_stock, key=lambda m: m["price"]) if in_stock else members[0]

            cards.append(CrawledCard(
                brand="onepiece",
                set_code=key[0],
                card_no=key[1],
                variant=key[2],
                rarity=key[3],
                name_ja=base["name_ja"],
                source=self.source,
                source_card_id=str(base["product_id"]),
                source_url=base["item_url"],
                image_url=base["image_url"],
                price_type="sell",
                price=base["price"],
                stock_status=base["stock_status"],
                raw={
                    "conditions": [
                        {
                            "condition": m["condition"],
                            "price": m["price"],
                            "stock_status": m["stock_status"],
                            "product_id": m["product_id"],
                        }
                        for m in members
                    ],
                },
            ))
        return cards

    # ------------------------------------------------------------------
    # parser
    # ------------------------------------------------------------------
    def _parse_list(self, html: str, *, set_url: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        results: list[dict] = []
        for block in soup.select("div.item_data"):
            parsed = self._parse_block(block)
            if parsed:
                results.append(parsed)
        return results

    def _parse_block(self, block) -> Optional[dict]:
        pid = block.get("data-product-id")
        img = block.find("img")
        alt = (img.get("alt") if img else "") or ""
        m = _ALT_RE.search(alt)
        if not m:
            return None
        condition_text, raw_name, raw_rarity, raw_code = m.groups()
        condition = condition_text.strip() if condition_text else "新品"

        parsed_code = parse_card_code(raw_code)
        if not parsed_code:
            return None
        set_code, card_no = parsed_code

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
        image_url = img.get("src") if img else None

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
