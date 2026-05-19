"""フルコンプ ONLINE SHOP (shopping.fullcomp.jp) スクレイパー — 販売価格

URL: https://shopping.fullcomp.jp/collections/pokemon?page=N
Shopify ベース。1ページ 80商品で全件 paginate 可能。

商品名形式: "[M3]ポケパッド【U】070/080" のように
  - [SET] = set_code (例: M3, SV9, SV11W, M02A など、または「ポケカ」等の雑多カテゴリ)
  - 商品名
  - 【rarity】
  - card_no / total

DB 対応: set_code prefix を {M, SV} のみに絞り、他は skip。
価格種別: sell。pokemon の sell ソースは fullahead (価格固定気味) のみだったので、
fullcomp 追加で 2 source 達成 → trending_cards (sell) が機能するようになる。

robots.txt: Shopify 標準 (寛容)。Sitemap のみで Disallow なし。
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
)

BASE = "https://shopping.fullcomp.jp"
PAGE_LIMIT = 100  # 安全枠 (実際は ~50 ページ程度想定)

# 商品名から (set_code, name, rarity, card_no) を抽出
# 例: "[M3]ニャースex【RR】061/080" → ("M3", "ニャースex", "RR", "061")
_NAME_RE = re.compile(
    r"^\[([^\]]+)\]([^【]+)【([^】]+)】\s*0*(\d+)\s*/\s*\d+\s*$"
)

# DB に格納される現役の set prefix のみ収集対象
_SUPPORTED_PKM_PREFIXES = {"M", "SV"}


def _normalize_pkm_set_code(raw: str) -> Optional[str]:
    """fullcomp 表記の pokemon set_code を DB 形式に正規化。

    DB の prefix 別ルール:
      M  シリーズ → 数字部分を 2桁ゼロ埋め (M3 → M03, M2A → M02A)
      SV シリーズ → ゼロ埋めなし (SV9 → SV9, SV11W → SV11W)
    対象外 prefix (旧 S/ADV/PCG、ポケカ汎用カテゴリ等) は None。
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


def _parse_product_name(text: str) -> Optional[tuple[str, str, str, str]]:
    """商品名から (set_code, card_name, raw_rarity, card_no) を返す。失敗時 None。"""
    m = _NAME_RE.match(text.strip())
    if not m:
        return None
    raw_set, raw_name, raw_rarity, raw_no = m.groups()
    set_code = _normalize_pkm_set_code(raw_set)
    if set_code is None:
        return None
    return set_code, raw_name.strip(), raw_rarity.strip(), raw_no.zfill(3)


class FullcompScraper(BaseScraper):
    source = "fullcomp"
    rate_interval = 3.0  # Shopify、寛容だが礼節を保つ

    BRAND_COLLECTION = {
        "pokemon": "pokemon",
        # onepiece は別 collection (今は未対応、後で需要あれば追加)
    }

    def __init__(self) -> None:
        super().__init__()
        self._cache: dict[str, list[CrawledCard]] = {}

    async def _load(self, brand: str) -> None:
        """1ブランドの全商品ページを paginate して取得・キャッシュ"""
        if brand in self._cache:
            return
        coll = self.BRAND_COLLECTION.get(brand)
        if not coll:
            self._cache[brand] = []
            return

        cards: list[CrawledCard] = []
        seen_handles: set[str] = set()
        page = 1
        while page <= PAGE_LIMIT:
            url = f"{BASE}/collections/{coll}?page={page}"
            try:
                resp = await self.http.get(url)
                html = resp.text
            except Exception:
                break

            soup = BeautifulSoup(html, "html.parser")
            page_cards = self._parse_page(soup, brand=brand, seen_handles=seen_handles)
            if not page_cards:
                # 空ページなら終了
                break
            cards.extend(page_cards)
            # link rel=next 無ければ終了
            nxt = soup.find("link", attrs={"rel": "next"})
            if not nxt:
                break
            page += 1

        self._cache[brand] = cards

    def _parse_page(
        self, soup: BeautifulSoup, *, brand: str, seen_handles: set[str]
    ) -> list[CrawledCard]:
        cards: list[CrawledCard] = []
        anchors = soup.find_all("a", href=re.compile(r"/products/"))
        for a in anchors:
            href = a.get("href", "")
            m_h = re.search(r"/products/([^?#/]+)", href)
            if not m_h:
                continue
            handle = m_h.group(1)
            if handle in seen_handles:
                continue
            text = a.get_text(" ", strip=True)
            if not text:
                continue
            parsed = _parse_product_name(text)
            if not parsed:
                continue
            set_code, raw_name, raw_rarity, card_no = parsed

            # 価格を親要素から探す (Shopify は商品 a の親 div に価格を含む)
            price = self._extract_price(a)
            if price is None:
                continue

            seen_handles.add(handle)

            rarity, base_variant = normalize_pokemon_rarity(raw_rarity)
            variant = detect_variant_from_name(raw_name, base_variant)
            name_ja = clean_card_name(raw_name) or raw_name

            cards.append(
                CrawledCard(
                    brand=brand,
                    set_code=set_code,
                    card_no=card_no,
                    variant=variant,
                    rarity=rarity,
                    name_ja=name_ja,
                    source=self.source,
                    source_card_id=handle,
                    source_url=f"{BASE}{href.split('?')[0]}",
                    image_url=None,  # 画像は商品詳細ページに行かないと取れないので skip
                    price_type="sell",
                    price=price,
                    stock_status="in_stock",
                    raw={"handle": handle, "raw_name": text, "raw_rarity": raw_rarity},
                )
            )
        return cards

    @staticmethod
    def _extract_price(anchor) -> Optional[int]:
        """商品 a の親を遡って価格 (¥123,456 形式) を抽出"""
        node = anchor
        for _ in range(8):
            node = node.parent
            if node is None:
                return None
            txt = node.get_text(" ", strip=True)
            m = re.search(r"¥\s*([\d,]+)", txt)
            if m:
                try:
                    return int(m.group(1).replace(",", ""))
                except ValueError:
                    return None
        return None

    async def list_sets(self, brand: str) -> list[str]:
        if brand not in self.BRAND_COLLECTION:
            return []
        await self._load(brand)
        return sorted({c.set_code for c in self._cache.get(brand, [])})

    async def fetch_set(self, brand: str, set_code: str) -> list[CrawledCard]:
        if brand not in self.BRAND_COLLECTION:
            return []
        await self._load(brand)
        return [c for c in self._cache.get(brand, []) if c.set_code == set_code]
