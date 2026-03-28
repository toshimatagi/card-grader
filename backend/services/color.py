"""色・印刷分析モジュール"""

import cv2
import numpy as np


def analyze_color(card_image: np.ndarray) -> dict:
    """
    カードの色・印刷品質を分析する。

    検出対象:
    - 色褪せ
    - インクむら
    - 光沢度
    - ホロ/フォイル判定
    - 色均一性

    Returns:
        dict: スコアと詳細データ
    """
    h, w = card_image.shape[:2]

    # 内部領域（ボーダーを除く）を分析対象に
    margin = int(min(h, w) * 0.1)
    inner = card_image[margin:h-margin, margin:w-margin]

    # 1. 色褪せ検出
    fading = _detect_fading(inner)

    # 2. インクむら・均一性
    ink_uniformity = _analyze_ink_uniformity(inner)

    # 3. 彩度分析
    saturation_score = _analyze_saturation(inner)

    # 4. ホロ/フォイル判定
    is_holo = _detect_holo(inner)

    # 5. 印刷ズレ検出
    print_misalignment = _detect_print_misalignment(inner)

    # スコア算出
    score = _calculate_score(fading, ink_uniformity, saturation_score, print_misalignment)

    # オーバーレイ画像生成
    overlay = _generate_overlay(card_image, fading, ink_uniformity, saturation_score)

    return {
        "score": score,
        "detail": {
            "fading": round(fading, 3),
            "ink_uniformity": round(ink_uniformity, 3),
            "is_holo": is_holo,
            "saturation_score": round(saturation_score, 3),
            "print_misalignment": round(print_misalignment, 3),
        },
        "overlay": overlay,
    }


def _detect_fading(image: np.ndarray) -> float:
    """
    色褪せを検出する。

    HSV色空間で彩度(S)と明度(V)の分布を分析。
    色褪せたカードは彩度が低く、明度が均一に高い傾向がある。

    Returns:
        float: 0.0（色褪せなし）〜 1.0（完全に色褪せ）
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    s_channel = hsv[:, :, 1].astype(float)
    v_channel = hsv[:, :, 2].astype(float)

    # 彩度の平均と標準偏差
    mean_saturation = np.mean(s_channel)
    std_saturation = np.std(s_channel)

    # 明度の平均
    mean_value = np.mean(v_channel)

    # 色褪せ指標: 彩度が低い + 明度が高い + 彩度のばらつきが小さい
    # 正常なカード: 彩度80-150、多様な色
    # 色褪せカード: 彩度30-60、くすんだ色

    fading_saturation = max(0, 1.0 - mean_saturation / 120.0)
    fading_flatness = max(0, 1.0 - std_saturation / 60.0)
    fading_brightness = max(0, (mean_value - 150) / 105.0) if mean_value > 150 else 0

    fading = (fading_saturation * 0.5 + fading_flatness * 0.3 + fading_brightness * 0.2)
    return min(max(fading, 0.0), 1.0)


def _analyze_ink_uniformity(image: np.ndarray) -> float:
    """
    インクの均一性を分析する。

    画像をグリッドに分割し、各セルの色分布の一貫性を測定。

    Returns:
        float: 0.0（不均一）〜 1.0（均一）
    """
    h, w = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # グリッド分割（6x8）
    grid_rows, grid_cols = 6, 8
    cell_h = h // grid_rows
    cell_w = w // grid_cols

    # 各セルの彩度平均を計算
    cell_means = []
    for r in range(grid_rows):
        for c in range(grid_cols):
            cell = hsv[r*cell_h:(r+1)*cell_h, c*cell_w:(c+1)*cell_w, 1]
            cell_means.append(np.mean(cell))

    # 隣接セル間の差の平均（急激な変化はインクむらの兆候）
    cell_means = np.array(cell_means).reshape(grid_rows, grid_cols)
    diffs = []

    for r in range(grid_rows):
        for c in range(grid_cols):
            if c + 1 < grid_cols:
                diffs.append(abs(cell_means[r][c] - cell_means[r][c+1]))
            if r + 1 < grid_rows:
                diffs.append(abs(cell_means[r][c] - cell_means[r+1][c]))

    # 差分が小さいほど均一
    mean_diff = np.mean(diffs) if diffs else 0
    # 正規化（差分20以下は均一とみなす）
    uniformity = max(0.0, 1.0 - mean_diff / 50.0)
    return min(uniformity, 1.0)


def _analyze_saturation(image: np.ndarray) -> float:
    """
    彩度の品質スコアを算出。

    Returns:
        float: 0.0（低品質）〜 1.0（高品質）
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    s_channel = hsv[:, :, 1].astype(float)

    mean_sat = np.mean(s_channel)
    std_sat = np.std(s_channel)

    # 良好な彩度: 平均60-140、適度なばらつき
    sat_score = 1.0
    if mean_sat < 40:
        sat_score *= mean_sat / 40.0
    elif mean_sat > 200:
        sat_score *= (255 - mean_sat) / 55.0

    # ばらつきが極端に低い（均一すぎ＝色褪せ）
    if std_sat < 20:
        sat_score *= std_sat / 20.0

    return min(max(sat_score, 0.0), 1.0)


def _detect_holo(image: np.ndarray) -> bool:
    """
    ホログラフィック/フォイルカードを検出する。

    ホロカードは特徴的な高彩度・高コントラストの虹色パターンを持つ。
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h_channel = hsv[:, :, 0].astype(float)
    s_channel = hsv[:, :, 1].astype(float)
    v_channel = hsv[:, :, 2].astype(float)

    # 色相のばらつきが大きい（虹色）
    h_std = np.std(h_channel)

    # 高彩度ピクセルの割合
    high_sat_ratio = np.sum(s_channel > 100) / max(s_channel.size, 1)

    # 明度のばらつきが大きい（光の反射）
    v_std = np.std(v_channel)

    # ホロ判定: 色相が多様 + 高彩度 + 明度変動大
    is_holo = (h_std > 40 and high_sat_ratio > 0.3 and v_std > 40)
    return bool(is_holo)


def _detect_print_misalignment(image: np.ndarray) -> float:
    """
    印刷ズレを検出する。

    Returns:
        float: 0.0（ズレなし）〜 1.0（大きなズレ）
    """
    # RGBチャネル間のズレを検出
    b, g, r = cv2.split(image)

    # 各チャネルのエッジ検出
    edges_r = cv2.Canny(r, 50, 150)
    edges_g = cv2.Canny(g, 50, 150)
    edges_b = cv2.Canny(b, 50, 150)

    # チャネル間のエッジ位置の差異
    diff_rg = cv2.absdiff(edges_r, edges_g)
    diff_rb = cv2.absdiff(edges_r, edges_b)

    misalignment_rg = np.sum(diff_rg > 0) / max(diff_rg.size, 1)
    misalignment_rb = np.sum(diff_rb > 0) / max(diff_rb.size, 1)

    # 正規化
    misalignment = (misalignment_rg + misalignment_rb) / 2
    # 通常のカードでも多少の差異はあるので、ベースラインを差し引く
    misalignment = max(0, misalignment - 0.05) / 0.15
    return min(misalignment, 1.0)


def _calculate_score(fading: float, uniformity: float,
                     saturation: float, misalignment: float) -> float:
    """色・印刷の総合スコアを算出"""
    # 各指標のペナルティ
    fading_penalty = fading * 4.0
    uniformity_penalty = (1.0 - uniformity) * 3.0
    saturation_penalty = (1.0 - saturation) * 2.0
    misalignment_penalty = misalignment * 3.0

    total_penalty = (fading_penalty + uniformity_penalty +
                     saturation_penalty + misalignment_penalty)

    score = max(1.0, 10.0 - total_penalty)
    return round(score * 2) / 2  # 0.5刻み


def _generate_overlay(card_image: np.ndarray, fading: float,
                      uniformity: float, saturation: float) -> np.ndarray:
    """色分析のオーバーレイ画像を生成"""
    h, w = card_image.shape[:2]

    # HSVの彩度チャネルをヒートマップとして表示
    hsv = cv2.cvtColor(card_image, cv2.COLOR_BGR2HSV)
    s_channel = hsv[:, :, 1]

    # 彩度ヒートマップ
    heatmap = cv2.applyColorMap(s_channel, cv2.COLORMAP_JET)

    # 元画像とヒートマップを半透明合成
    overlay = cv2.addWeighted(card_image, 0.6, heatmap, 0.4, 0)

    # スコア情報を表示
    font = cv2.FONT_HERSHEY_SIMPLEX
    texts = [
        f"Fading: {fading:.2f}",
        f"Uniformity: {uniformity:.2f}",
        f"Saturation: {saturation:.2f}",
    ]

    for i, text in enumerate(texts):
        color = (0, 255, 0) if "0.0" in text or float(text.split(": ")[1]) < 0.3 else (0, 0, 255)
        if "Uniformity" in text or "Saturation" in text:
            val = float(text.split(": ")[1])
            color = (0, 255, 0) if val > 0.7 else (0, 0, 255)
        cv2.putText(overlay, text, (10, 25 + i * 25),
                    font, 0.5, (255, 255, 255), 2)
        cv2.putText(overlay, text, (10, 25 + i * 25),
                    font, 0.5, color, 1)

    return overlay
