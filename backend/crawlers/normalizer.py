"""各サイトの表記を DB の canonical 形式に正規化する

- set_code: 大文字3〜4文字 + 数字2〜3桁（例: OP15, ST30, EB04, PRB01, P）
- card_no: 3桁ゼロ埋め
- rarity: 'C'|'UC'|'R'|'SR'|'SEC'|'L'|'SP'|'P'
- variant: 'normal'|'parallel'|'super_parallel'|'manga'|'alt_art'|'other'
"""

from __future__ import annotations

import re

_TYPE_RE = re.compile(r"^([A-Z]+)(\d+)-(\d+)$")


def parse_card_code(code: str) -> tuple[str, str] | None:
    """'OP15-007' → ('OP15', '007'), 'P-001' → ('P', '001')

    マッチしなければ None。
    """
    code = code.strip().upper().replace(" ", "")
    m = _TYPE_RE.match(code)
    if not m:
        return None
    prefix, num, card_no = m.groups()
    set_code = f"{prefix}{num}"
    return set_code, card_no.zfill(3)


_BASE_RARITIES = {"C", "UC", "R", "SR", "SEC", "L", "SP", "P"}


def normalize_yuyutei_rarity(label: str) -> tuple[str, str]:
    """各サイトのレアリティ表記を (rarity, variant) に正規化。
    対応形式:
      - 'SR', 'SEC', 'L', 'P'  → (X, 'normal')
      - 'P-SR', 'P-SEC' (遊々亭・ティアワン形式) → (X, 'parallel')
      - 'SR/P', 'SEC/P' (カードラッシュ形式)     → (X, 'parallel')
      - '-' ドン!!カード → ('DON', 'normal')
    未知は ('OTHER', 'other')
    """
    key = label.strip().upper()
    if key == "-":
        return ("DON", "normal")
    if key.startswith("P-"):
        base = key[2:]
        if base in _BASE_RARITIES:
            return (base, "parallel")
    if key.endswith("/P"):
        base = key[:-2]
        if base in _BASE_RARITIES:
            return (base, "parallel")
    if key in _BASE_RARITIES:
        return (key, "normal")
    return ("OTHER", "other")


def detect_variant_from_name(name: str, base_variant: str) -> str:
    """カード名に「(パラレル)」「(スーパーパラレル)」等が含まれる場合、variantを上書き"""
    if "スーパーパラレル" in name:
        return "super_parallel"
    if "パラレル" in name:
        return "parallel"
    if "マンガ" in name:
        return "manga"
    if "アルトアート" in name or "オルトアート" in name:
        return "alt_art"
    return base_variant


def clean_card_name(name: str) -> str:
    """カード名から末尾の(パラレル)等を除去してベース名にする"""
    return re.sub(r"\s*[（(](パラレル|スーパーパラレル|マンガ|アルトアート|オルトアート)[)）]\s*", "", name).strip()


def clean_price(text: str) -> int | None:
    """'1,980 円' → 1980, '在庫なし' や '-' → None"""
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None
