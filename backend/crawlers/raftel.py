"""トレカラフテル（tcg-raftel.com）スクレイパー - ONE PIECE専門通販

URL:
  - トップ: https://www.tcg-raftel.com/
  - セット別: /product-list/{gid}?page={N}  (1ページ60件想定)

トップページに「全商品 (ROMANCE DAWN OP-01)」のような形式のリンクが並ぶ。
そこから set_code → gid マップを抽出する。

product 表示形式 (アンカーテキスト):
  '{カード名} 【タグ1】【タグ2】...【色】【OP08-058】 [ inv_id ] 2,480 円 (税込)'

解析:
  - 末尾近くの 【XX99-NNN】 が型番
  - 直後の N,NNN 円 が販売価格
  - その他 【...】 タグから rarity / variant を判定
    - C/UC/R/SR/SEC/L/SP/P のいずれかをrarityに採用
    - リーダーパラレル → rarity=L, variant=parallel
    - スーパーパラレル/パラレル/アルトアート/マンガ → variant
    - シークレット等の未知タグ → variant=other (rarityが取れていれば)
"""

from __future__ import annotations

import re
from typing import Optional

from bs4 import BeautifulSoup

from .base import BaseScraper, CrawledCard
from .normalizer import clean_price, parse_card_code

BASE = "https://www.tcg-raftel.com"

_TAG_RE = re.compile(r"【([^】]+)】")
_CODE_RE = re.compile(r"^[A-Z]+\d+-\d+$")
_PRICE_RE = re.compile(r"([\d,]+)\s*円")
_LIST_LABEL_RE = re.compile(r"全商品\s*\(.*?([A-Z]+)-(\d+)\)")
_PRODUCT_LIST_RE = re.compile(r"/product-list/(\d+)")
_PRODUCT_RE = re.compile(r"/product/(\d+)")

_BASE_RARITIES = {"C", "UC", "R", "SR", "SEC", "L", "SP", "P"}

MAX_PAGES = 30


class RaftelScraper(BaseScraper):
    source = "raftel"
    rate_interval = 2.0

    def __init__(self) -> None:
        super().__init__()
        self._set_to_gid: dict[str, int] = {}

    async def list_sets(self, brand: str) -> list[str]:
        if brand != "onepiece":
            return []
        html = (await self.http.get(f"{BASE}/")).text
        soup = BeautifulSoup(html, "html.parser")

        mapping: dict[str, int] = {}
        for a in soup.find_all("a", href=_PRODUCT_LIST_RE):
            href = a.get("href", "")
            m_id = _PRODUCT_LIST_RE.search(href)
            if not m_id:
                continue
            gid = int(m_id.group(1))
            text = a.get_text(" ", strip=True)
            m = _LIST_LABEL_RE.search(text)
            if not m:
                continue
            prefix, num = m.groups()
            set_code = f"{prefix}{num}"
            mapping.setdefault(set_code, gid)

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

        seen: set[str] = set()
        cards: list[CrawledCard] = []

        for page in range(1, MAX_PAGES + 1):
            url = f"{BASE}/product-list/{gid}"
            if page > 1:
                url = f"{url}?page={page}"
            try:
                html = (await self.http.get(url)).text
            except Exception:
                break

            page_items = self._parse_list(html)
            if not page_items:
                break

            new = 0
            for it in page_items:
                pid = it["product_id"]
                if pid in seen:
                    continue
                seen.add(pid)
                card = self._to_card(it)
                if card:
                    cards.append(card)
                    new += 1
            if new == 0:
                break

        return cards

    def _parse_list(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        results: list[dict] = []
        seen_pid: set[str] = set()
        for a in soup.find_all("a", href=_PRODUCT_RE):
            href = a.get("href", "")
            m = _PRODUCT_RE.search(href)
            if not m:
                continue
            pid = m.group(1)
            if pid in seen_pid:
                continue
            text = a.get_text(" ", strip=True)
            if not text:
                continue
            tags = _TAG_RE.findall(text)
            if not tags:
                continue
            seen_pid.add(pid)

            img = a.find("img")
            image_url = img.get("src") if img else None
            if image_url and image_url.startswith("/"):
                image_url = f"{BASE}{image_url}"

            results.append({
                "product_id": pid,
                "url": href if href.startswith("http") else f"{BASE}{href}",
                "text": text,
                "tags": tags,
                "image_url": image_url,
            })
        return results

    def _to_card(self, it: dict) -> Optional[CrawledCard]:
        tags: list[str] = it["tags"]
        text: str = it["text"]

        code_tag = next((t for t in tags if _CODE_RE.match(t)), None)
        if not code_tag:
            return None
        parsed = parse_card_code(code_tag)
        if not parsed:
            return None
        set_code, card_no = parsed

        # 価格: 型番タグより後ろにある最初の "N,NNN 円"
        try:
            after = text.split(f"【{code_tag}】", 1)[1]
        except IndexError:
            after = text
        price_m = _PRICE_RE.search(after)
        price = clean_price(price_m.group(0)) if price_m else None

        rarity, variant = self._classify(tags)

        # 商品名: 先頭から最初の 【 までをトリム
        name_ja = text.split("【", 1)[0].strip()

        return CrawledCard(
            brand="onepiece",
            set_code=set_code,
            card_no=card_no,
            variant=variant,
            rarity=rarity,
            name_ja=name_ja,
            source=self.source,
            source_card_id=it["product_id"],
            source_url=it["url"],
            image_url=it["image_url"],
            price_type="sell",
            price=price,
            stock_status=None,
            raw={"text": text, "tags": tags},
        )

    @staticmethod
    def _classify(tags: list[str]) -> tuple[str, str]:
        """tags から (rarity, variant) を決定。

        - 「リーダーパラレル」→ ('L', 'parallel')
        - 「シークレット」→ rarity='SEC'
        - C/UC/R/SR/L/P のいずれか → rarity (SP/SEC は除外: 別マーカー)
        - 「スーパーパラレル」→ variant='super_parallel'
        - 「パラレル」→ variant='parallel' (super_parallel が後勝ちで上書き)
        - 「アルトアート」「マンガ」→ variant
        - 「SP」「プロモ」「フラッグシップ」その他未知タグ → variant='other'
        """
        if "リーダーパラレル" in tags:
            return ("L", "parallel")

        BASE = {"C", "UC", "R", "SR", "L", "P"}
        rarity: Optional[str] = None
        detected: set[str] = set()
        has_other = False
        for t in tags:
            if _CODE_RE.match(t):
                continue
            if re.fullmatch(r"[赤青緑紫黄黒白]+", t):
                continue
            if t == "シークレット":
                rarity = "SEC"
                continue
            if t == "リーダー":
                rarity = "L"
                continue
            if rarity is None and t in BASE:
                rarity = t
                continue
            if t == "スーパーパラレル":
                detected.add("super_parallel")
                continue
            if t == "パラレル":
                detected.add("parallel")
                continue
            if t in ("アルトアート", "オルトアート"):
                detected.add("alt_art")
                continue
            if t in ("マンガ", "漫画"):
                detected.add("manga")
                continue
            has_other = True
        if rarity is None:
            rarity = "OTHER"

        # variant 優先順位: super_parallel > alt_art > manga > other (SP等) > parallel > normal
        # 未知マーカー (SP / プロモ / フラッグシップ 等) があれば「パラレル」より「other」優先
        # — それらは物理的に別カードなので分離する
        for v in ("super_parallel", "alt_art", "manga"):
            if v in detected:
                return (rarity, v)
        if has_other:
            return (rarity, "other")
        if "parallel" in detected:
            return (rarity, "parallel")
        return (rarity, "normal")
