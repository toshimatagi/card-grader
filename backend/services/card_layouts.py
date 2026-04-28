"""カードレイアウト・テンプレート定義

フルアート系 (パラレル/AA/SP/manga 等) ではセンタリングの内枠が曖昧なため、
カード上のランドマーク (コスト/パワー/名前帯など) の期待位置を保持し、
ユーザーが指定したランドマーク座標とのズレで design_alignment を計算する。

座標は「カード矩形を [0,1] x [0,1] に正規化した空間」での比率。
ランドマークは画像座標で渡されるが、外枠 (outer_quad) を使った
透視変換で正規化空間に変換してから template と比較する。

注: 期待位置は ONE PIECE TCG の標準的なカード寸法 (63x88mm) に基づく
近似値。将来的に公式画像から実測して refine する余地がある。
"""

from __future__ import annotations

import numpy as np

# 各レイアウト種別のランドマーク期待位置 (x, y) ∈ [0,1]
# x=0: 左端、x=1: 右端、y=0: 上端、y=1: 下端
LAYOUT_TEMPLATES: dict[str, dict[str, tuple[float, float]]] = {
    "character": {
        "cost": (0.10, 0.08),         # 左上 コスト円
        "power": (0.83, 0.92),        # 右下 パワー数値
        "name_band": (0.50, 0.86),    # 下中央 名前帯
    },
    "leader": {
        "life": (0.83, 0.10),         # 右上 ライフ
        "power": (0.83, 0.92),
        "name_band": (0.50, 0.86),
    },
    "event": {
        "cost": (0.10, 0.08),
        "name_band": (0.50, 0.86),
    },
    "stage": {
        "cost": (0.10, 0.08),
        "name_band": (0.50, 0.86),
    },
}


def is_fullart_eligible(brand_id: str, rarity_id: str, has_border: bool, border_type: str) -> bool:
    """このカードに design_alignment 機能を提供すべきか判定。

    has_border=False または border_type='none' なら fullart 相当扱い。
    """
    if not has_border:
        return True
    if border_type in ("none",):
        return True
    return False


def get_template_for(brand_id: str, rarity_id: str) -> dict[str, tuple[float, float]]:
    """ブランドとレアリティから適切なランドマークテンプレートを返す。"""
    if brand_id == "onepiece":
        if rarity_id == "l":
            return LAYOUT_TEMPLATES["leader"]
        # AA, SP, manga, TR 等は通常キャラクター扱い (リーダーパラレルは別途)
        return LAYOUT_TEMPLATES["character"]
    return LAYOUT_TEMPLATES["character"]


def compute_design_alignment(
    landmarks_image: dict,
    outer_corners: dict,
    template: dict[str, tuple[float, float]],
    image_size: tuple[int, int] | None = None,
) -> tuple[float, dict]:
    """ユーザー指定ランドマークの design_alignment スコアを計算。

    Args:
        landmarks_image: {"cost": [x,y], "power": [x,y], ...} 画像座標 (px)
        outer_corners: {"tl":[x,y],"tr":[x,y],"br":[x,y],"bl":[x,y]} 画像座標
        template: 期待位置 (正規化座標)
        image_size: (w,h) 入力ランドマーク座標が異なる場合のスケール用

    Returns:
        (score 0-10, 詳細dict)
    """
    if not landmarks_image:
        return (0.0, {"marked": 0, "deviations": {}})

    try:
        src = np.array(
            [outer_corners["tl"], outer_corners["tr"], outer_corners["br"], outer_corners["bl"]],
            dtype=np.float32,
        )
    except (KeyError, TypeError):
        return (0.0, {"marked": 0, "error": "outer_corners 不正"})

    dst = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
    try:
        import cv2
        H = cv2.getPerspectiveTransform(src, dst)
    except Exception as e:
        return (0.0, {"marked": 0, "error": str(e)})

    deviations: dict[str, dict] = {}
    scores: list[float] = []
    for name, expected in template.items():
        raw = landmarks_image.get(name)
        if not raw:
            continue
        try:
            x, y = float(raw[0]), float(raw[1])
        except (TypeError, IndexError, ValueError):
            continue

        # 透視変換で正規化座標に
        pt = np.array([[[x, y]]], dtype=np.float32)
        transformed = cv2.perspectiveTransform(pt, H)
        nx, ny = float(transformed[0][0][0]), float(transformed[0][0][1])

        ex, ey = expected
        dx = nx - ex
        dy = ny - ey
        dist = (dx * dx + dy * dy) ** 0.5

        # 0% offset = 10, 5% = 5, 10%以上 = 0  (1% offset = 9点)
        landmark_score = max(0.0, 10.0 - dist * 100.0)
        scores.append(landmark_score)
        deviations[name] = {
            "expected": [round(ex, 3), round(ey, 3)],
            "actual": [round(nx, 3), round(ny, 3)],
            "offset_pct": round(dist * 100, 2),
            "score": round(landmark_score, 2),
        }

    if not scores:
        return (0.0, {"marked": 0, "deviations": {}})

    avg = sum(scores) / len(scores)
    return (
        round(avg, 1),
        {
            "marked": len(scores),
            "deviations": deviations,
            "average_score": round(avg, 2),
        },
    )
