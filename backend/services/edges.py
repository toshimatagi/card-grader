"""エッジ・角分析モジュール"""

import cv2
import numpy as np


def analyze_edges(card_image: np.ndarray) -> dict:
    """
    カードのエッジ（辺）と角の品質を分析する。

    検出対象:
    - エッジの直線性
    - 角の丸みの均一性
    - 角のダメージ・摩耗

    Returns:
        dict: スコアと詳細データ
    """
    h, w = card_image.shape[:2]
    gray = cv2.cvtColor(card_image, cv2.COLOR_BGR2GRAY)

    # 1. エッジの直線性分析
    edge_straightness = _analyze_edge_straightness(gray)

    # 2. 角の丸み均一性
    corner_uniformity = _analyze_corner_roundness(gray)

    # 3. 角の個別ダメージ評価
    corner_damages = _evaluate_corners(gray)

    # スコア算出
    score = _calculate_score(edge_straightness, corner_uniformity, corner_damages)

    # オーバーレイ画像
    overlay = _generate_overlay(card_image, gray, corner_damages)

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


def _evaluate_corners(gray: np.ndarray) -> list:
    """4角を個別に評価してダメージを検出"""
    h, w = gray.shape
    corner_size = int(min(h, w) * 0.1)

    corner_regions = {
        "top-left": (0, 0, corner_size, corner_size),
        "top-right": (0, w-corner_size, corner_size, w),
        "bottom-left": (h-corner_size, 0, h, corner_size),
        "bottom-right": (h-corner_size, w-corner_size, h, w),
    }

    damages = []

    for name, (y1, x1, y2, x2) in corner_regions.items():
        region = gray[y1:y2, x1:x2]

        # テクスチャ解析
        laplacian = cv2.Laplacian(region, cv2.CV_64F)
        lap_std = np.std(laplacian)

        # エッジ密度
        edges = cv2.Canny(region, 50, 150)
        edge_density = np.sum(edges > 0) / max(edges.size, 1)

        # 明度のばらつき
        intensity_std = np.std(region.astype(float))

        # ダメージ判定
        # 正常な角: 適度なエッジ（L字の角）、低いテクスチャ変化
        # ダメージ角: 高いテクスチャ変化、不規則なエッジ

        damage_score = 0.0
        if lap_std > 30:
            damage_score += (lap_std - 30) / 50
        if edge_density > 0.12:
            damage_score += (edge_density - 0.12) / 0.1
        if intensity_std > 50:
            damage_score += (intensity_std - 50) / 50

        damage_score = min(damage_score, 1.0)

        if damage_score > 0.3:
            severity = "minor" if damage_score < 0.6 else "major"
            damages.append({
                "corner": name,
                "severity": severity,
                "damage_score": round(damage_score, 2),
            })

    return damages


def _calculate_score(straightness: float, uniformity: float,
                     corner_damages: list) -> float:
    """エッジ・角の総合スコアを算出"""
    # エッジの直線性
    edge_score = straightness * 10.0

    # 角の均一性
    corner_score = uniformity * 10.0

    # 角のダメージペナルティ
    damage_penalty = 0.0
    for d in corner_damages:
        if d["severity"] == "major":
            damage_penalty += 1.5
        else:
            damage_penalty += 0.5

    # 加重平均
    base = edge_score * 0.4 + corner_score * 0.6
    final = max(1.0, base - damage_penalty)

    return round(final * 2) / 2  # 0.5刻み


def _generate_overlay(card_image: np.ndarray, gray: np.ndarray,
                      corner_damages: list) -> np.ndarray:
    """エッジ・角分析のオーバーレイ画像を生成"""
    overlay = card_image.copy()
    h, w = overlay.shape[:2]

    # エッジラインを描画
    edges = cv2.Canny(gray, 50, 150)
    edge_colored = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    edge_colored[edges > 0] = [0, 255, 0]  # 緑でエッジ表示
    overlay = cv2.addWeighted(overlay, 0.8, edge_colored, 0.2, 0)

    # 角の領域をハイライト
    corner_size = int(min(h, w) * 0.1)

    corner_positions = {
        "top-left": (0, 0),
        "top-right": (w - corner_size, 0),
        "bottom-left": (0, h - corner_size),
        "bottom-right": (w - corner_size, h - corner_size),
    }

    # ダメージのある角を赤で、正常な角を緑でマーク
    damaged_corners = {d["corner"] for d in corner_damages}

    for name, (x, y) in corner_positions.items():
        color = (0, 0, 255) if name in damaged_corners else (0, 255, 0)
        cv2.rectangle(overlay, (x, y), (x + corner_size, y + corner_size),
                      color, 2)

    # ダメージ情報
    for i, d in enumerate(corner_damages):
        text = f"{d['corner']}: {d['severity']}"
        cv2.putText(overlay, text, (10, h - 20 - i * 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)

    return overlay
