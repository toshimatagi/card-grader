"""TCGカードブランド・レアリティ定義

各ブランドごとにレアリティとボーダー/サーフェス特性を定義。
センタリング分析のアルゴリズム切替に使用する。
"""

from dataclasses import dataclass, field


@dataclass
class CardRarity:
    id: str
    name_ja: str
    name_en: str
    has_border: bool
    border_type: str  # "standard" | "thin" | "gold" | "silver" | "none"
    surface_type: str  # "normal" | "holo" | "reverse_holo" | "textured" | "gold"


@dataclass
class CardBrand:
    id: str
    name_ja: str
    name_en: str
    size: str  # "standard" (63x88mm) | "small" (59x86mm)
    # ボーダー比率（カード幅/高さに対するボーダー幅の比率）
    border_ratio_lr: float = 0.045  # 左右ボーダー ≈ カード幅の4.5%
    border_ratio_top: float = 0.035  # 上ボーダー
    border_ratio_bottom: float = 0.065  # 下ボーダー（名前欄分やや広い）
    rarities: list[CardRarity] = field(default_factory=list)


# ======================================================================
# ポケモンカードゲーム
# ======================================================================
POKEMON = CardBrand(
    id="pokemon",
    name_ja="ポケモンカードゲーム",
    name_en="Pokemon TCG",
    size="standard",
    border_ratio_lr=0.048,
    border_ratio_top=0.040,
    border_ratio_bottom=0.070,
    rarities=[
        CardRarity("c", "コモン (C)", "Common", True, "standard", "normal"),
        CardRarity("uc", "アンコモン (UC)", "Uncommon", True, "standard", "normal"),
        CardRarity("r", "レア (R)", "Rare Holo", True, "standard", "holo"),
        CardRarity("reverse_holo", "リバースホロ", "Reverse Holo", True, "standard", "reverse_holo"),
        CardRarity("rr", "ダブルレア (RR) / ex", "Double Rare", True, "standard", "holo"),
        CardRarity("ar", "アートレア (AR)", "Art Rare", False, "none", "holo"),
        CardRarity("sar", "スペシャルアートレア (SAR)", "Special Art Rare", False, "none", "textured"),
        CardRarity("sr", "スーパーレア (SR)", "Super Rare", False, "none", "textured"),
        CardRarity("ur", "ウルトラレア (UR)", "Ultra Rare", True, "gold", "gold"),
        CardRarity("s", "シャイニーレア (S)", "Shiny Rare", True, "standard", "holo"),
        CardRarity("promo", "プロモ (PR)", "Promo", True, "standard", "normal"),
    ],
)

# ======================================================================
# ONE PIECE カードゲーム
# ======================================================================
ONE_PIECE = CardBrand(
    id="onepiece",
    name_ja="ONE PIECEカードゲーム",
    name_en="One Piece Card Game",
    size="standard",
    border_ratio_lr=0.038,
    border_ratio_top=0.030,
    border_ratio_bottom=0.055,
    rarities=[
        CardRarity("c", "コモン (C)", "Common", True, "standard", "normal"),
        CardRarity("uc", "アンコモン (UC)", "Uncommon", True, "standard", "normal"),
        CardRarity("r", "レア (R)", "Rare", True, "standard", "holo"),
        CardRarity("sr", "スーパーレア (SR)", "Super Rare", True, "silver", "holo"),
        CardRarity("sec", "シークレットレア (SEC)", "Secret Rare", True, "thin", "textured"),
        CardRarity("l", "リーダー (L)", "Leader", True, "standard", "holo"),
        CardRarity("aa", "パラレル (AA)", "Alternate Art", False, "none", "textured"),
        CardRarity("sp", "スペシャルアート (SP)", "Special Art", False, "none", "textured"),
        CardRarity("manga", "マンガレア", "Manga Rare", False, "none", "normal"),
        CardRarity("tr", "トレジャーレア (TR)", "Treasure Rare", False, "none", "textured"),
        CardRarity("don", "ドン!!カード", "DON!! Card", True, "standard", "normal"),
        CardRarity("don_alt", "ドン!!パラレル", "DON!! Alternate", True, "standard", "holo"),
        CardRarity("promo", "プロモ (PR)", "Promo", True, "standard", "normal"),
    ],
)

# ======================================================================
# ドラゴンボール Fusion World
# ======================================================================
DRAGONBALL_FW = CardBrand(
    id="dragonball_fw",
    name_ja="ドラゴンボール Fusion World",
    name_en="Dragon Ball Fusion World",
    size="standard",
    border_ratio_lr=0.042,
    border_ratio_top=0.035,
    border_ratio_bottom=0.060,
    rarities=[
        CardRarity("c", "コモン (C)", "Common", True, "standard", "normal"),
        CardRarity("uc", "アンコモン (UC)", "Uncommon", True, "standard", "normal"),
        CardRarity("r", "レア (R)", "Rare", True, "standard", "holo"),
        CardRarity("sr", "スーパーレア (SR)", "Super Rare", True, "standard", "holo"),
        CardRarity("scr", "シークレットレア (SCR)", "Secret Rare", True, "standard", "holo"),
        CardRarity("l", "リーダー (L)", "Leader", True, "standard", "holo"),
        CardRarity("alt_art", "オルトアート", "Alt Art", False, "none", "holo"),
        CardRarity("super_alt", "スーパーオルトアート", "Super Alt Art", False, "none", "gold"),
        CardRarity("ultra_alt", "ウルトラオルトアート", "Ultra Alt Art", False, "none", "textured"),
        CardRarity("promo", "プロモ (PR)", "Promo", True, "standard", "normal"),
    ],
)

# ======================================================================
# 遊戯王OCG
# ======================================================================
YUGIOH = CardBrand(
    id="yugioh",
    name_ja="遊戯王OCG",
    name_en="Yu-Gi-Oh! OCG",
    size="small",
    border_ratio_lr=0.045,
    border_ratio_top=0.035,
    border_ratio_bottom=0.060,
    rarities=[
        CardRarity("n", "ノーマル (N)", "Normal", True, "standard", "normal"),
        CardRarity("nr", "ノーマルレア (NR)", "Normal Rare", True, "standard", "normal"),
        CardRarity("r", "レア (R)", "Rare", True, "standard", "normal"),
        CardRarity("sr", "スーパーレア (SR)", "Super Rare", True, "standard", "holo"),
        CardRarity("ur", "ウルトラレア (UR)", "Ultra Rare", True, "standard", "holo"),
        CardRarity("ultr", "アルティメットレア (UltR)", "Ultimate Rare", True, "standard", "textured"),
        CardRarity("scr", "シークレットレア (ScR)", "Secret Rare", True, "standard", "holo"),
        CardRarity("escr", "エクストラシークレット (EScR)", "Extra Secret Rare", True, "standard", "holo"),
        CardRarity("hgr", "ホログラフィックレア (HGR)", "Holographic Rare", True, "standard", "holo"),
        CardRarity("qcscr", "クォーターセンチュリー (QCScR)", "Quarter Century Secret", True, "standard", "holo"),
        CardRarity("cr", "コレクターズレア (CR)", "Collector's Rare", True, "standard", "textured"),
        CardRarity("overframe", "オーバーフレーム", "Overframe", False, "none", "holo"),
        CardRarity("gmr", "グランドマスターレア (GMR)", "Grand Master Rare", False, "none", "textured"),
        CardRarity("promo", "プロモ (PR)", "Promo", True, "standard", "normal"),
    ],
)

# ======================================================================
# 全ブランドマップ
# ======================================================================
ALL_BRANDS: dict[str, CardBrand] = {
    "pokemon": POKEMON,
    "onepiece": ONE_PIECE,
    "dragonball_fw": DRAGONBALL_FW,
    "yugioh": YUGIOH,
}


def get_brand(brand_id: str) -> CardBrand | None:
    return ALL_BRANDS.get(brand_id)


def get_rarity(brand_id: str, rarity_id: str) -> CardRarity | None:
    brand = get_brand(brand_id)
    if not brand:
        return None
    for r in brand.rarities:
        if r.id == rarity_id:
            return r
    return None


def get_border_ratios(brand_id: str) -> dict:
    """ブランドの既知ボーダー比率を返す"""
    brand = get_brand(brand_id)
    if not brand:
        return {"lr": 0.045, "top": 0.035, "bottom": 0.065}
    return {
        "lr": brand.border_ratio_lr,
        "top": brand.border_ratio_top,
        "bottom": brand.border_ratio_bottom,
    }


def get_centering_mode(brand_id: str, rarity_id: str) -> str:
    """カードタイプに応じたセンタリング分析モードを返す。

    Returns:
        "bordered"  - 標準ボーダー検出（外枠 vs 内枠）
        "borderless" - ボーダーレス/フルアート（カード外縁の対称性のみ）
        "gold_border" - 金ボーダー検出（ポケカURなど）
        "thin_border" - 薄ボーダー検出（ワンピSECなど）
    """
    rarity = get_rarity(brand_id, rarity_id)
    if not rarity:
        return "bordered"

    if not rarity.has_border or rarity.border_type == "none":
        return "borderless"
    elif rarity.border_type == "gold":
        return "gold_border"
    elif rarity.border_type in ("thin", "silver"):
        return "thin_border"
    else:
        return "bordered"


def brands_to_api_response() -> list[dict]:
    """フロントエンド用にブランド一覧をJSON形式で返す"""
    result = []
    for brand in ALL_BRANDS.values():
        result.append({
            "id": brand.id,
            "name_ja": brand.name_ja,
            "name_en": brand.name_en,
            "size": brand.size,
            "rarities": [
                {
                    "id": r.id,
                    "name_ja": r.name_ja,
                    "name_en": r.name_en,
                    "has_border": r.has_border,
                    "border_type": r.border_type,
                    "surface_type": r.surface_type,
                }
                for r in brand.rarities
            ],
        })
    return result
