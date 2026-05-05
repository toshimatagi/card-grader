"""フルアヘッドスクレイパー - ブランド別ドメイン

対象ブランド:
- onepiece: https://fullahead-onepiece-cardgame.com  (URL: /shopbrand/opc-{set}/page{N}/recommend/)
- pokemon : https://pokemon-card-fullahead.com       (URL: /shopbrand/{set}/page{N}/)

両ドメインとも同じ EC-CUBE ベースの CMS (itemName / itemPrice / M_item-stock-smallstock)。

itemName 形式 (ブランド別):
  onepiece: 【variant】型番 カード名 レアリティ [【extra】]
            例: 【スーパーパラレル】OP15-118 エネル SEC【コミック背景】
                【パック】OP15-010 アルビダ C
  pokemon : PK-{セット}-{番号} カード名 レアリティ
            例: PK-M4-120 メガゲッコウガex MUR
                PK-SV6-103 リザードン SAR
"""

from __future__ import annotations

import re
from typing import Optional

from bs4 import BeautifulSoup

from .base import BaseScraper, CrawledCard
from .normalizer import (
    clean_card_name,
    clean_price,
    normalize_pokemon_rarity,
    normalize_yuyutei_rarity,
    parse_card_code,
)

# ブランド別の BASE URL
_BRAND_BASE = {
    "onepiece": "https://fullahead-onepiece-cardgame.com",
    "pokemon": "https://pokemon-card-fullahead.com",
}

# プレフィックス【variant】はオプショナル。通常版はプレフィックスなし。
# 型番 カード名 レアリティ [【extra】]
_OP_NAME_RE = re.compile(
    r"^(?:【([^】]+)】\s*)?([A-Z]+\d+-\d+)\s+(.+?)\s+([A-Z/-]+)(?:\s*【([^】]+)】)?\s*$"
)

# Pokemon 専用: "PK-M4-120 メガゲッコウガex MUR" 形式
# PK- プレフィックス + セット部分 (英大数字 + 末尾A-Z可) + - + 数字 + 名前 + レアリティ
_PKM_NAME_RE = re.compile(
    r"^PK-([A-Z]+\d+[A-Z]?)-(\d+)\s+(.+?)\s+([A-Z]+)\s*$"
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


def _normalize_pkm_set_code(raw: str) -> str:
    """fullahead 表記の pokemon set_code を yuyutei 互換 (数字部2桁ゼロ埋め) に正規化。
    例: 'M4' → 'M04', 'M2A' → 'M02A', 'sv6' → 'SV06'

    yuyutei が出力する 'M03'/'M04' (2桁ゼロ埋め) に揃える。
    """
    raw = raw.strip().upper()
    m = re.match(r"^([A-Z]+)(\d+)([A-Z]?)$", raw)
    if not m:
        return raw
    prefix, num, suffix = m.groups()
    if len(num) == 1:
        num = num.zfill(2)
    return f"{prefix}{num}{suffix}"


def _denormalize_pkm_slug(set_code: str) -> str:
    """正規化済 set_code (M04) を fullahead URL 用の slug (m04) に変換。
    fullahead は yuyutei と同じく zero-padded (m04, m02a) を使う仕様。
    例: 'M04' → 'm04', 'M02A' → 'm02a'
    """
    return set_code.strip().lower()


class FullaheadScraper(BaseScraper):
    source = "fullahead"
    rate_interval = 2.5

    async def list_sets(self, brand: str) -> list[str]:
        base = _BRAND_BASE.get(brand)
        if not base:
            return []

        try:
            html = (await self.http.get(f"{base}/")).text
        except Exception:
            html = ""

        found: set[str] = set()
        if brand == "onepiece":
            # /shopbrand/opc-xxx or /view/category/opc-xxx
            for m in re.finditer(r"/(?:view/category|shopbrand)/opc-([a-z0-9]+)", html):
                code = m.group(1).upper()
                if re.match(r"^(OP|ST|EB|PRB)\d+$", code):
                    found.add(code)
            return sorted(found) if found else _generate_op_sets()
        else:
            # pokemon: /shopbrand/{set} 直下。event/supply/mc/reserve 等の非セットを除外
            non_set = {"event", "kizu", "mc", "reserve", "supply", "toyger", "unopbox", "valuable", "ct869"}
            for m in re.finditer(r"/shopbrand/([a-z0-9]+)/?[\"\'<\?]", html):
                code = m.group(1)
                if code in non_set:
                    continue
                # M/SV/SM/S/BW/XY 系の英大文字+数字+末尾英大文字 のパターンに正規化
                norm = _normalize_pkm_set_code(code)
                if re.match(r"^(M|SV|SM|S|BW|XY)\d+[A-Z]?$", norm):
                    found.add(norm)
            return sorted(found)

    async def fetch_set(self, brand: str, set_code: str) -> list[CrawledCard]:
        base = _BRAND_BASE.get(brand)
        if not base:
            return []

        # URL組立はブランド別。fullahead の pokemon 側は /shopbrand/{slug}/page{N}/ 形式で、
        # slug はトップに出ていた raw 表記 (zero-padなし) なので set_code の数字部分を1桁に
        # 戻す必要がある。例: M04 → m4
        if brand == "onepiece":
            slug = f"opc-{set_code.lower()}"
            url_tpl = f"{base}/shopbrand/{slug}/page{{page}}/recommend/"
        else:
            slug = _denormalize_pkm_slug(set_code)
            url_tpl = f"{base}/shopbrand/{slug}/page{{page}}/"

        cards: list[CrawledCard] = []
        seen_keys: set[tuple] = set()
        empty_pages = 0

        for page in range(1, MAX_PAGES + 1):
            url = url_tpl.format(page=page)
            try:
                text = (await self.http.get(url)).text
            except Exception:
                break
            total_on_page = text.count('<span class="itemName">')
            if total_on_page == 0:
                break

            page_cards = self._parse_list(text, brand=brand, set_code=set_code)
            new = 0
            for c in page_cards:
                key = (c.set_code, c.card_no, c.variant, c.rarity, c.source_card_id)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                cards.append(c)
                new += 1

            if new == 0:
                empty_pages += 1
                if empty_pages >= 2:
                    break
            else:
                empty_pages = 0
            if total_on_page < 40:
                break
        return cards

    def _parse_list(self, html: str, *, brand: str, set_code: str) -> list[CrawledCard]:
        soup = BeautifulSoup(html, "html.parser")
        cards: list[CrawledCard] = []
        for name_el in soup.select("span.itemName"):
            c = self._parse_item(name_el, brand=brand, set_code=set_code)
            if c:
                cards.append(c)
        return cards

    def _parse_item(self, name_el, *, brand: str, set_code: str) -> Optional[CrawledCard]:
        text = name_el.get_text(" ", strip=True)

        if brand == "pokemon":
            m = _PKM_NAME_RE.match(text)
            if not m:
                return None
            raw_set, raw_no, raw_name, raw_rarity = m.groups()
            parsed_set_code = _normalize_pkm_set_code(raw_set)
            if parsed_set_code != set_code:
                return None
            card_no = raw_no.zfill(3)
            rarity, base_variant = normalize_pokemon_rarity(raw_rarity)
            variant = base_variant
            name_ja = raw_name.strip()
            extra = None
            stock_status_default = "in_stock"
        else:
            m = _OP_NAME_RE.match(text)
            if not m:
                return None
            prefix, raw_code, raw_name, raw_rarity, extra = m.groups()
            parsed = parse_card_code(raw_code)
            if not parsed:
                return None
            parsed_set_code, card_no = parsed
            if parsed_set_code != set_code:
                return None
            rarity, base_variant = normalize_yuyutei_rarity(raw_rarity)
            variant = _PREFIX_TO_VARIANT.get(prefix.strip(), base_variant) if prefix else base_variant
            name_ja = clean_card_name(raw_name)
            stock_status_default = "in_stock"

        # 親の <a> から product_id、itemPrice、M_item-stock-smallstock を辿る
        a = name_el.find_parent("a")
        item_url = a.get("href") if a else None
        product_id: Optional[str] = None
        if item_url:
            pid_m = re.search(r"/shopdetail/(\d+)", item_url)
            if pid_m:
                product_id = pid_m.group(1)

        container = a.parent if a else name_el.parent
        price_el = container.select_one("span.itemPrice strong") if container else None
        price = clean_price(price_el.get_text(strip=True)) if price_el else None

        stock_el = container.select_one("span.M_item-stock-smallstock") if container else None
        stock_text = stock_el.get_text(strip=True) if stock_el else ""
        stock_status = self._parse_stock(stock_text) if stock_text else stock_status_default

        img = container.select_one("span.itemImg img") if container else None
        image_url = img.get("src") if img else None

        base = _BRAND_BASE[brand]
        source_url = f"{base}{item_url}" if item_url and item_url.startswith("/") else item_url

        return CrawledCard(
            brand=brand,
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
