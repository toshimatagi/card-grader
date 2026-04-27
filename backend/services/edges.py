"""エッジ・角分析モジュール"""

import cv2
import numpy as np


def analyze_edges(
    card_image: np.ndarray,
    is_holo: bool = False,
    outer_corners: dict | None = None,
) -> dict:
    """
    カードのエッジ（辺）と角の品質を分析する。

    Args:
        card_image: BGR
        is_holo: ホロカードなら検出を緩める
        outer_corners: 手動指定された実カード4隅 {tl,tr,bl,br: [x,y]}。
            指定があればそこを corner regions として分析する (傾き対応)。
    """
    h, w = card_image.shape[:2]
    gray = cv2.cvtColor(card_image, cv2.COLOR_BGR2GRAY)
    sens = 1.4 if is_holo else 1.0

    edge_straightness = _analyze_edge_straightness(gray)
    corner_uniformity = _analyze_corner_roundness(gray)
    corner_damages = _evaluate_corners(gray, sens, outer_corners)

    # スコア算出
    score = _calculate_score(edge_straightness, corner_uniformity, corner_damages)

    # オーバーレイ画像
    overlay = _generate_overlay(card_image, gray, corner_damages, outer_corners)

    return {
        "score": score,
        "detail": {
            "edge_straightness": round(edge_straightness, 3),
            "corner_roundness_uniformity": round(corner_uniformity, 3),
            "corner_damages": corner_damages,
        },
        "overlay": overlay,
    }


def _analyze_edge_straightness(gray: np.ndarray) -> float:
    """
    4辺のエッジの直線性を分析する。

    Returns:
        float: 0.0（歪み大）〜 1.0（完全な直線）
    """
    h, w = gray.shape

    # エッジ検出
    edges = cv2.Canny(gray, 50, 150)

    # 各辺の近傍を抽出して直線性を検査
    margin = int(min(h, w) * 0.05)

    edge_regions = {
        "top": edges[:margin, margin:w-margin],
        "bottom": edges[h-margin:, margin:w-margin],
        "left": edges[margin:h-margin, :margin],
        "right": edges[margin:h-margin, w-margin:],
    }

    straightness_scores = []

    for name, region in edge_regions.items():
        if name in ("top", "bottom"):
            # 水平方向の辺: 各列のエッジピクセルの位置のばらつき
            edge_positions = []
            for col in range(region.shape[1]):
                col_data = region[:, col]
                nonzero = np.nonzero(col_data)[0]
                if len(nonzero) > 0:
                    edge_positions.append(nonzero[0] if name == "top" else nonzero[-1])

            if edge_positions:
                # 位置のばらつきが小さいほど直線
                std = np.std(edge_positions)
                score = max(0.0, 1.0 - std / (margin * 0.5))
                straightness_scores.append(score)
        else:
            # 垂直方向の辺
            edge_positions = []
            for row in range(region.shape[0]):
                row_data = region[row, :]
                nonzero = np.nonzero(row_data)[0]
                if len(nonzero) > 0:
                    edge_positions.append(nonzero[0] if name == "left" else nonzero[-1])

            if edge_positions:
                std = np.std(edge_positions)
                score = max(0.0, 1.0 - std / (margin * 0.5))
                straightness_scores.append(score)

    return float(np.mean(straightness_scores)) if straightness_scores else 0.8


def _analyze_corner_roundness(gray: np.ndarray) -> float:
    """
    4角の丸みの均一性を分析する。

    Returns:
        float: 0.0（不均一）〜 1.0（均一）
    """
    h, w = gray.shape
    corner_size = int(min(h, w) * 0.08)

    corners = {
        "tl": gray[:corner_size, :corner_size],
        "tr": gray[:corner_size, w-corner_size:],
        "bl": gray[h-corner_size:, :corner_size],
        "br": gray[h-corner_size:, w-corner_size:],
    }

    # 各角のエッジ検出し、曲率を推定
    curvatures = []

    for name, region in corners.items():
        edges = cv2.Canny(region, 50, 150)
        edge_points = np.column_stack(np.where(edges > 0))

        if len(edge_points) < 10:
            curvatures.append(0)
            continue

        # エッジ点の分布から丸みを推定
        # 角に近いエッジ点の分布が円弧状であれば均一
        if name == "tl":
            distances = np.sqrt(edge_points[:, 0]**2 + edge_points[:, 1]**2)
        elif name == "tr":
            distances = np.sqrt(edge_points[:, 0]**2 +
                                (corner_size - edge_points[:, 1])**2)
        elif name == "bl":
            distances = np.sqrt((corner_size - edge_points[:, 0])**2 +
                                edge_points[:, 1]**2)
        else:
            distances = np.sqrt((corner_size - edge_points[:, 0])**2 +
                                (corner_size - edge_points[:, 1])**2)

        # 距離のばらつきが小さいほど均一な丸み
        if len(distances) > 0:
            mean_dist = np.mean(distances)
            std_dist = np.std(distances)
            curvature = mean_dist / max(std_dist, 1)
            curvatures.append(curvature)

    if not curvatures or max(curvatures) == 0:
        return 0.8

    # 4角の曲率のばらつきで均一性を評価
    curvatures = np.array(curvatures)
    mean_curv = np.mean(curvatures)
    std_curv = np.std(curvatures)

    # 係数を正規化 (std/mean が小さいほど均一)
    cv = std_curv / max(mean_curv, 1)
    uniformity = max(0.0, 1.0 - cv * 2)
    return min(uniformity, 1.0)


def _evaluate_corners(
    gray: np.ndarray,
    sens: float = 1.0,
    outer_corners: dict | None = None,
) -> list:
    """4角を個別に評価してダメージを検出。outer_corners が指定されていれば
    そのカード実角を中心にした正方形領域を分析する (傾き対応)。"""
    h, w = gray.shape
    corner_size = int(min(h, w) * 0.1)
    corner_regions = _corner_regions(h, w, corner_size, outer_corners)

    damages = []

    # 各しきい値を sens で緩和。下限を上げ、ダメージ判定の発火率を下げる。
    lap_base = 50 * sens     # 元: 30
    edge_base = 0.20 * sens  # 元: 0.12
    int_base = 70 * sens     # 元: 50
    minor_thresh = 0.55      # 元: 0.30
    major_thresh = 0.85      # 元: 0.60

    for name, (y1, x1, y2, x2) in corner_regions.items():
        region = gray[y1:y2, x1:x2]

        laplacian = cv2.Laplacian(region, cv2.CV_64F)
        lap_std = float(np.std(laplacian))
        edges = cv2.Canny(region, 50, 150)
        edge_density = float(np.sum(edges > 0)) / max(edges.size, 1)
        intensity_std = float(np.std(region.astype(float)))

        damage_score = 0.0
        if lap_std > lap_base:
            damage_score += (lap_std - lap_base) / 80
        if edge_density > edge_base:
            damage_score += (edge_density - edge_base) / 0.15
        if intensity_std > int_base:
            damage_score += (intensity_std - int_base) / 80
        damage_score = min(damage_score, 1.0)

        if damage_score > minor_thresh:
            severity = "minor" if damage_score < major_thresh else "major"
            damages.append({
                "corner": name,
                "severity": severity,
                "damage_score": round(damage_score, 2),
            })

    return damages


def _corner_regions(
    h: int, w: int, corner_size: int, outer_corners: dict | None
) -> dict:
    """各角の (y1, x1, y2, x2) 領域を返す。outer_corners があればその点を中心にした
    正方形を取り、無ければ画像の四隅。"""
    name_to_key = {
        "top-left": "tl",
        "top-right": "tr",
        "bottom-left": "bl",
        "bottom-right": "br",
    }
    if outer_corners:
        regions = {}
        half = corner_size // 2
        for name, key in name_to_key.items():
            try:
                cx, cy = outer_corners[key]
                cx, cy = int(cx), int(cy)
            except (KeyError, TypeError, ValueError):
                # 1つでも欠けていたらフォールバック
                outer_corners = None
                break
            y1 = max(0, cy - half)
            y2 = min(h, cy + half)
            x1 = max(0, cx - half)
            x2 = min(w, cx + half)
            if y2 <= y1 or x2 <= x1:
                outer_corners = None
                break
            regions[name] = (y1, x1, y2, x2)
        if outer_corners:
            return regions
    return {
        "top-left": (0, 0, corner_size, corner_size),
        "top-right": (0, w - corner_size, corner_size, w),
        "bottom-left": (h - corner_size, 0, h, corner_size),
        "bottom-right": (h - corner_size, w - corner_size, h, w),
    }


def _calculate_score(straightness: float, uniformity: float,
                     corner_damages: list) -> float:
    """エッジ・角の総合スコアを算出 (再キャリブレーション)"""
    edge_score = straightness * 10.0
    corner_score = uniformity * 10.0

    # ダメージペナルティを軽減 (元: major=1.5 minor=0.5)
    damage_penalty = 0.0
    for d in corner_damages:
        damage_penalty += 0.8 if d["severity"] == "major" else 0.3

    base = edge_score * 0.4 + corner_score * 0.6
    final = max(1.0, base - damage_penalty)
    return round(final * 2) / 2


def _generate_overlay(card_image: np.ndarray, gray: np.ndarray,
                      corner_damages: list,
                      outer_corners: dict | None = None) -> np.ndarray:
    """エッジ・角分析のオーバーレイ画像を生成"""
    overlay = card_image.copy()
    h, w = overlay.shape[:2]

    # エッジラインを描画
    edges = cv2.Canny(gray, 50, 150)
    edge_colored = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    edge_colored[edges > 0] = [0, 255, 0]  # 緑でエッジ表示
    overlay = cv2.addWeighted(overlay, 0.8, edge_colored, 0.2, 0)

    corner_size = int(min(h, w) * 0.1)
    regions = _corner_regions(h, w, corner_size, outer_corners)
    damaged_corners = {d["corner"] for d in corner_damages}

    for name, (y1, x1, y2, x2) in regions.items():
        color = (0, 0, 255) if name in damaged_corners else (0, 255, 0)
        cv2.rectangle(overlay, (x1, y1), (x2, y2), color, 2)

    # outer_corners があれば実カード輪郭も黄色で表示
    if outer_corners:
        try:
            pts = np.array(
                [outer_corners[k] for k in ("tl", "tr", "br", "bl")], dtype=np.int32
            )
            cv2.polylines(overlay, [pts], isClosed=True, color=(0, 255, 255), thickness=2)
        except (KeyError, TypeError, ValueError):
            pass

    # ダメージ情報
    for i, d in enumerate(corner_damages):
        text = f"{d['corner']}: {d['severity']}"
        cv2.putText(overlay, text, (10, h - 20 - i * 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)

    return overlay
