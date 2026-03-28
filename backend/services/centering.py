"""センタリング分析モジュール"""

import cv2
import numpy as np


def analyze_centering(card_image: np.ndarray) -> dict:
    """
    カードのセンタリング（枠の対称性）を分析する。

    ボーダー（枠）の幅を上下左右で計測し、
    その比率からPSA風のスコアを算出する。

    Returns:
        dict: スコアと詳細データ
    """
    h, w = card_image.shape[:2]

    # グレースケール変換
    gray = cv2.cvtColor(card_image, cv2.COLOR_BGR2GRAY)

    # ボーダー検出: カードの枠は通常、内側のアートワークと異なる色
    borders = _detect_borders(gray, card_image)

    left = borders["left"]
    right = borders["right"]
    top = borders["top"]
    bottom = borders["bottom"]

    # ゼロ除算防止
    lr_total = left + right if (left + right) > 0 else 1
    tb_total = top + bottom if (top + bottom) > 0 else 1

    # 比率算出（大きい方/小さい方）
    lr_larger = max(left, right)
    lr_smaller = min(left, right)
    tb_larger = max(top, bottom)
    tb_smaller = min(top, bottom)

    lr_pct_larger = round(lr_larger / lr_total * 100)
    lr_pct_smaller = 100 - lr_pct_larger
    tb_pct_larger = round(tb_larger / tb_total * 100)
    tb_pct_smaller = 100 - tb_pct_larger

    lr_ratio = f"{lr_pct_larger}/{lr_pct_smaller}"
    tb_ratio = f"{tb_pct_larger}/{tb_pct_smaller}"

    # スコアリング（PSA基準）
    max_deviation = max(lr_pct_larger, tb_pct_larger)
    score = _calculate_score(max_deviation)

    # オーバーレイ画像生成
    overlay = _generate_overlay(card_image, borders)

    return {
        "score": score,
        "detail": {
            "lr_ratio": lr_ratio,
            "tb_ratio": tb_ratio,
            "left_border": round(left, 1),
            "right_border": round(right, 1),
            "top_border": round(top, 1),
            "bottom_border": round(bottom, 1),
        },
        "overlay": overlay,
    }


def _detect_borders(gray: np.ndarray, color_image: np.ndarray) -> dict:
    """
    ボーダー幅を検出する。

    手法: カード画像の各辺からスキャンし、
    内側のアートワーク領域との色差が大きく変化する点を検出。
    """
    h, w = gray.shape

    # 方法1: エッジ検出ベースのボーダー検出
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    # 各辺のスキャン範囲（カードの30%まで）
    max_scan = int(min(h, w) * 0.3)

    # 左ボーダー: 左端から水平方向にスキャン
    left_border = _scan_border(edges, "left", max_scan)

    # 右ボーダー
    right_border = _scan_border(edges, "right", max_scan)

    # 上ボーダー
    top_border = _scan_border(edges, "top", max_scan)

    # 下ボーダー
    bottom_border = _scan_border(edges, "bottom", max_scan)

    # 方法2: 色変化ベースの補正
    hsv = cv2.cvtColor(color_image, cv2.COLOR_BGR2HSV)
    color_borders = _detect_borders_by_color(hsv)

    # 2つの方法の平均を取って安定化
    return {
        "left": (left_border + color_borders["left"]) / 2,
        "right": (right_border + color_borders["right"]) / 2,
        "top": (top_border + color_borders["top"]) / 2,
        "bottom": (bottom_border + color_borders["bottom"]) / 2,
    }


def _scan_border(edges: np.ndarray, direction: str, max_scan: int) -> float:
    """エッジ画像を各方向からスキャンしてボーダー幅を検出"""
    h, w = edges.shape

    # スキャンラインの設定
    if direction == "left":
        # 中央付近の水平ラインを複数スキャン
        scan_lines = []
        for y in range(int(h * 0.3), int(h * 0.7), max(1, h // 20)):
            line = edges[y, :max_scan]
            nonzero = np.nonzero(line)[0]
            if len(nonzero) > 0:
                scan_lines.append(nonzero[0])
        return float(np.median(scan_lines)) if scan_lines else max_scan * 0.1

    elif direction == "right":
        scan_lines = []
        for y in range(int(h * 0.3), int(h * 0.7), max(1, h // 20)):
            line = edges[y, w - max_scan:]
            nonzero = np.nonzero(line)[0]
            if len(nonzero) > 0:
                scan_lines.append(max_scan - nonzero[-1])
            else:
                pass
        return float(np.median(scan_lines)) if scan_lines else max_scan * 0.1

    elif direction == "top":
        scan_lines = []
        for x in range(int(w * 0.3), int(w * 0.7), max(1, w // 20)):
            line = edges[:max_scan, x]
            nonzero = np.nonzero(line)[0]
            if len(nonzero) > 0:
                scan_lines.append(nonzero[0])
        return float(np.median(scan_lines)) if scan_lines else max_scan * 0.1

    elif direction == "bottom":
        scan_lines = []
        for x in range(int(w * 0.3), int(w * 0.7), max(1, w // 20)):
            line = edges[h - max_scan:, x]
            nonzero = np.nonzero(line)[0]
            if len(nonzero) > 0:
                scan_lines.append(max_scan - nonzero[-1])
        return float(np.median(scan_lines)) if scan_lines else max_scan * 0.1

    return max_scan * 0.1


def _detect_borders_by_color(hsv: np.ndarray) -> dict:
    """色変化に基づくボーダー検出"""
    h, w = hsv.shape[:2]
    max_scan = int(min(h, w) * 0.3)

    def find_color_change(line_values: np.ndarray) -> int:
        """値の変化が大きい点を検出"""
        if len(line_values) < 10:
            return int(len(line_values) * 0.1)
        # 移動平均の差分で変化点を検出
        kernel_size = max(3, len(line_values) // 20)
        smoothed = np.convolve(line_values.astype(float), np.ones(kernel_size)/kernel_size, mode='valid')
        if len(smoothed) < 2:
            return int(len(line_values) * 0.1)
        diffs = np.abs(np.diff(smoothed))
        threshold = np.mean(diffs) + 2 * np.std(diffs)
        peaks = np.where(diffs > threshold)[0]
        if len(peaks) > 0:
            return int(peaks[0] + kernel_size // 2)
        return int(len(line_values) * 0.1)

    # 中央の水平ラインのV(明度)チャネルで検出
    mid_y = h // 2
    left_line = hsv[mid_y, :max_scan, 2]
    right_line = hsv[mid_y, w-max_scan:, 2][::-1]

    mid_x = w // 2
    top_line = hsv[:max_scan, mid_x, 2]
    bottom_line = hsv[h-max_scan:, mid_x, 2][::-1]

    return {
        "left": float(find_color_change(left_line)),
        "right": float(find_color_change(right_line)),
        "top": float(find_color_change(top_line)),
        "bottom": float(find_color_change(bottom_line)),
    }


def _calculate_score(max_deviation_pct: float) -> float:
    """PSA基準でセンタリングスコアを算出"""
    if max_deviation_pct <= 52:
        return 10.0
    elif max_deviation_pct <= 55:
        return 9.5
    elif max_deviation_pct <= 57:
        return 9.0
    elif max_deviation_pct <= 60:
        return 8.5
    elif max_deviation_pct <= 62:
        return 8.0
    elif max_deviation_pct <= 65:
        return 7.5
    elif max_deviation_pct <= 67:
        return 7.0
    elif max_deviation_pct <= 70:
        return 6.5
    elif max_deviation_pct <= 73:
        return 6.0
    elif max_deviation_pct <= 76:
        return 5.0
    elif max_deviation_pct <= 80:
        return 4.0
    else:
        return 3.0


def _generate_overlay(card_image: np.ndarray, borders: dict) -> np.ndarray:
    """センタリング分析のオーバーレイ画像を生成"""
    overlay = card_image.copy()
    h, w = overlay.shape[:2]

    left = int(borders["left"])
    right = w - int(borders["right"])
    top = int(borders["top"])
    bottom = h - int(borders["bottom"])

    # ボーダー領域を半透明で表示
    border_overlay = overlay.copy()

    # 左ボーダー（青）
    cv2.rectangle(border_overlay, (0, 0), (left, h), (255, 100, 100), -1)
    # 右ボーダー（青）
    cv2.rectangle(border_overlay, (right, 0), (w, h), (255, 100, 100), -1)
    # 上ボーダー（緑）
    cv2.rectangle(border_overlay, (0, 0), (w, top), (100, 255, 100), -1)
    # 下ボーダー（緑）
    cv2.rectangle(border_overlay, (0, bottom), (w, h), (100, 255, 100), -1)

    # 半透明合成
    cv2.addWeighted(border_overlay, 0.3, overlay, 0.7, 0, overlay)

    # ボーダー幅のテキスト表示
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(overlay, f"L:{borders['left']:.1f}", (5, h//2),
                font, 0.5, (255, 255, 255), 2)
    cv2.putText(overlay, f"R:{borders['right']:.1f}", (w - 80, h//2),
                font, 0.5, (255, 255, 255), 2)
    cv2.putText(overlay, f"T:{borders['top']:.1f}", (w//2 - 20, 20),
                font, 0.5, (255, 255, 255), 2)
    cv2.putText(overlay, f"B:{borders['bottom']:.1f}", (w//2 - 20, h - 10),
                font, 0.5, (255, 255, 255), 2)

    # 中心線
    cv2.line(overlay, (w//2, 0), (w//2, h), (0, 0, 255), 1)
    cv2.line(overlay, (0, h//2), (w, h//2), (0, 0, 255), 1)

    return overlay
