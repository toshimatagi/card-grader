"""センタリング分析モジュール（v2: 撮影位置に依存しない方式）

方針:
  従来: カード画像の端からの絶対距離でボーダーを測定 → 撮影角度に依存
  改善: カード外枠の矩形と内部印刷枠の矩形の「中心のズレ」で判定
        → 撮影位置・角度が多少ずれても、相対関係は保たれる
"""

import cv2
import numpy as np


def analyze_centering(card_image: np.ndarray, mode: str = "bordered") -> dict:
    """
    カードのセンタリング（印刷の対称性）を分析する。

    モード:
      - "bordered": 外枠 vs 内枠のボーダー幅比較（通常カード）
      - "borderless": カード外縁の対称性のみ（フルアート/ボーダーレス）
      - "gold_border": 金ボーダー検出（ポケカURなど）
      - "thin_border": 薄ボーダー検出（ワンピSECなど）

    Returns:
        dict: スコアと詳細データ
    """
    h, w = card_image.shape[:2]

    # カード外縁の矩形（= 画像全体に近い）
    outer_rect = _detect_outer_boundary(card_image)

    if mode == "borderless":
        # ボーダーレスカード: カード外縁の対称性で判定
        inner_rect = _detect_borderless_inner(card_image, outer_rect)
    elif mode == "gold_border":
        # 金ボーダー: HSVの金色領域を検出
        inner_rect = _detect_gold_border_inner(card_image, outer_rect)
    elif mode == "thin_border":
        # 薄ボーダー: より繊細なエッジ検出
        inner_rect = _detect_thin_border_inner(card_image, outer_rect)
    else:
        # 標準ボーダー: 既存のアンサンブル手法
        inner_rect = _detect_inner_frame(card_image, outer_rect)

    # 外枠・内枠からボーダー幅を算出
    borders = _compute_borders(outer_rect, inner_rect)

    left = borders["left"]
    right = borders["right"]
    top = borders["top"]
    bottom = borders["bottom"]

    # 比率算出
    lr_total = left + right if (left + right) > 0 else 1
    tb_total = top + bottom if (top + bottom) > 0 else 1

    lr_pct_larger = round(max(left, right) / lr_total * 100)
    lr_pct_smaller = 100 - lr_pct_larger
    tb_pct_larger = round(max(top, bottom) / tb_total * 100)
    tb_pct_smaller = 100 - tb_pct_larger

    lr_ratio = f"{lr_pct_larger}/{lr_pct_smaller}"
    tb_ratio = f"{tb_pct_larger}/{tb_pct_smaller}"

    # スコアリング
    max_deviation = max(lr_pct_larger, tb_pct_larger)
    score = _calculate_score(max_deviation)

    # オーバーレイ画像
    overlay = _generate_overlay(card_image, outer_rect, inner_rect, borders)

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


# ---------------------------------------------------------------------------
# 外枠検出
# ---------------------------------------------------------------------------

def _detect_outer_boundary(image: np.ndarray) -> tuple:
    """
    カードの外枠（物理的な境界）を検出する。

    前処理で正面化されているので、画像全体がほぼカード領域。
    背景が少し残っている場合も考慮し、最大の矩形輪郭を探す。

    Returns:
        (x, y, w, h) のタプル
    """
    h, w = image.shape[:2]

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # 適応的閾値で背景とカードを分離
    # Otsu の二値化
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # 輪郭検出
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        # 面積最大の輪郭の外接矩形
        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        if area > h * w * 0.3:
            return cv2.boundingRect(largest)

    # フォールバック: 画像全体を2%マージン付きで使用
    margin_x = int(w * 0.02)
    margin_y = int(h * 0.02)
    return (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)


# ---------------------------------------------------------------------------
# 内部印刷枠検出（コア改善部分）
# ---------------------------------------------------------------------------

def _detect_inner_frame(image: np.ndarray, outer_rect: tuple) -> tuple:
    """
    カード内部の印刷領域（アートワーク＋テキスト枠）を検出する。

    3つの手法で検出し、中央値（メディアン）を採用して安定化:
      1. 色差ベース: ボーダー色と内部色の境界を検出
      2. エッジ集中度: エッジ密度が急増する位置を検出
      3. テンプレートマッチング的なアプローチ: 矩形構造を直接検出

    Returns:
        (x, y, w, h) のタプル（内部印刷領域）
    """
    ox, oy, ow, oh = outer_rect
    card_roi = image[oy:oy+oh, ox:ox+ow]
    ch, cw = card_roi.shape[:2]

    # 手法1: ボーダー色を基準にした色差検出
    result1 = _detect_by_border_color(card_roi)

    # 手法2: エッジ密度の急増点を検出
    result2 = _detect_by_edge_density(card_roi)

    # 手法3: 輪郭ベースの内部矩形検出
    result3 = _detect_by_contour(card_roi)

    # 3手法のメディアンを取って安定化
    lefts = [r[0] for r in [result1, result2, result3] if r is not None]
    tops = [r[1] for r in [result1, result2, result3] if r is not None]
    rights = [r[0] + r[2] for r in [result1, result2, result3] if r is not None]
    bottoms = [r[1] + r[3] for r in [result1, result2, result3] if r is not None]

    if not lefts:
        # 全手法失敗時のフォールバック
        margin = int(min(ch, cw) * 0.08)
        return (ox + margin, oy + margin, ow - 2 * margin, oh - 2 * margin)

    l = int(np.median(lefts))
    t = int(np.median(tops))
    r = int(np.median(rights))
    b = int(np.median(bottoms))

    return (ox + l, oy + t, r - l, b - t)


def _detect_by_border_color(roi: np.ndarray) -> tuple | None:
    """
    ボーダーの色を検出し、その色が終わる位置を内部枠とする。

    TCGカードのボーダーは通常、単色 or グラデーションの枠。
    カード四辺のサンプルピクセルからボーダー色を推定し、
    その色が変わる位置を内側から走査して検出。
    """
    h, w = roi.shape[:2]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    # 四辺の端から5%の領域をボーダー色としてサンプリング
    sample_width = max(5, int(min(h, w) * 0.05))

    border_samples = np.vstack([
        hsv[:sample_width, :, :].reshape(-1, 3),          # 上
        hsv[h-sample_width:, :, :].reshape(-1, 3),         # 下
        hsv[:, :sample_width, :].reshape(-1, 3),           # 左
        hsv[:, w-sample_width:, :].reshape(-1, 3),         # 右
    ])

    # ボーダー色の中央値
    border_hue = np.median(border_samples[:, 0])
    border_sat = np.median(border_samples[:, 1])
    border_val = np.median(border_samples[:, 2])

    # ボーダー色に近いピクセルのマスクを作成
    hue_diff = np.abs(hsv[:, :, 0].astype(float) - border_hue)
    # 色相は循環するので180を考慮
    hue_diff = np.minimum(hue_diff, 180 - hue_diff)
    sat_diff = np.abs(hsv[:, :, 1].astype(float) - border_sat)
    val_diff = np.abs(hsv[:, :, 2].astype(float) - border_val)

    # ボーダー色に近いピクセル
    border_mask = ((hue_diff < 20) & (sat_diff < 60) & (val_diff < 60)).astype(np.uint8) * 255

    # モルフォロジー処理でノイズ除去
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    border_mask = cv2.morphologyEx(border_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    border_mask = cv2.morphologyEx(border_mask, cv2.MORPH_OPEN, kernel)

    # ボーダーでない領域（= 内部印刷領域）のバウンディングボックス
    inner_mask = cv2.bitwise_not(border_mask)

    # 内部領域の輪郭を検出
    contours, _ = cv2.findContours(inner_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # 最大面積の輪郭
    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    if area < h * w * 0.2:
        return None

    return cv2.boundingRect(largest)


def _detect_by_edge_density(roi: np.ndarray) -> tuple | None:
    """
    四辺からスキャンし、エッジ密度が急増する位置を内部枠の開始点とする。

    ボーダー領域: エッジが少ない（単色に近い）
    内部領域: エッジが多い（アートワーク・テキスト）
    """
    h, w = roi.shape[:2]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    max_scan = int(min(h, w) * 0.25)
    results = {}

    for direction in ["left", "right", "top", "bottom"]:
        densities = []

        if direction == "left":
            for col in range(max_scan):
                strip = edges[int(h*0.2):int(h*0.8), col]
                densities.append(np.mean(strip > 0))
        elif direction == "right":
            for col in range(w - 1, w - max_scan - 1, -1):
                strip = edges[int(h*0.2):int(h*0.8), col]
                densities.append(np.mean(strip > 0))
        elif direction == "top":
            for row in range(max_scan):
                strip = edges[row, int(w*0.2):int(w*0.8)]
                densities.append(np.mean(strip > 0))
        elif direction == "bottom":
            for row in range(h - 1, h - max_scan - 1, -1):
                strip = edges[row, int(w*0.2):int(w*0.8)]
                densities.append(np.mean(strip > 0))

        if not densities:
            return None

        # 移動平均で平滑化
        window = max(3, len(densities) // 10)
        smoothed = np.convolve(densities, np.ones(window) / window, mode='valid')

        if len(smoothed) < 5:
            results[direction] = max_scan // 5
            continue

        # エッジ密度の急増点を検出
        threshold = np.mean(smoothed) * 0.5
        above = np.where(smoothed > threshold)[0]
        results[direction] = int(above[0] + window // 2) if len(above) > 0 else max_scan // 5

    left = results.get("left", 0)
    top = results.get("top", 0)
    right = w - results.get("right", 0)
    bottom = h - results.get("bottom", 0)

    if right <= left or bottom <= top:
        return None

    return (left, top, right - left, bottom - top)


def _detect_by_contour(roi: np.ndarray) -> tuple | None:
    """
    内部の矩形構造を直接検出する。

    カード内部のアートワーク枠やテキスト枠は通常、
    明確な矩形の輪郭を持つ。
    """
    h, w = roi.shape[:2]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 30, 100)

    # 膨張して近接エッジを結合
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    dilated = cv2.dilate(edges, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    best_rect = None
    best_score = 0

    card_area = h * w

    for contour in contours:
        area = cv2.contourArea(contour)
        # 内部枠はカード面積の30%〜90%
        if area < card_area * 0.3 or area > card_area * 0.9:
            continue

        # 矩形に近いか
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.03 * peri, True)

        if 4 <= len(approx) <= 6:
            rect = cv2.boundingRect(contour)
            rx, ry, rw, rh = rect

            # 矩形度（面積 / 外接矩形面積）
            rectangularity = area / max(rw * rh, 1)

            # カードの内側にあるか
            margin = int(min(h, w) * 0.03)
            if rx > margin and ry > margin and rx + rw < w - margin and ry + rh < h - margin:
                score = rectangularity * (area / card_area)
                if score > best_score:
                    best_score = score
                    best_rect = rect

    return best_rect


# ---------------------------------------------------------------------------
# モード別の内部枠検出（ボーダーレス / 金ボーダー / 薄ボーダー）
# ---------------------------------------------------------------------------

def _detect_borderless_inner(image: np.ndarray, outer_rect: tuple) -> tuple:
    """
    ボーダーレス/フルアートカードのセンタリング検出。

    フルアートカードにはボーダーがないため、
    カード外縁の「印刷マージン」（白い端や裁断ズレ）を検出する。
    印刷がカード端まで達しているか、わずかな白縁があるかで判定。
    """
    ox, oy, ow, oh = outer_rect
    roi = image[oy:oy+oh, ox:ox+ow]
    h, w = roi.shape[:2]

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    # 四辺から非常に狭い範囲（2%）をスキャンして白/淡色の縁を検出
    scan_depth = max(3, int(min(h, w) * 0.02))
    borders = {}

    for direction in ["left", "right", "top", "bottom"]:
        if direction == "left":
            strip = gray[:, :scan_depth * 5]
            profile = np.mean(strip, axis=0)
        elif direction == "right":
            strip = gray[:, w - scan_depth * 5:]
            profile = np.mean(strip, axis=0)[::-1]
        elif direction == "top":
            strip = gray[:scan_depth * 5, :]
            profile = np.mean(strip, axis=1)
        else:
            strip = gray[h - scan_depth * 5:, :]
            profile = np.mean(strip, axis=1)[::-1]

        # 明るさの変化点を検出（白縁 → 印刷領域の境界）
        if len(profile) < 3:
            borders[direction] = 1
            continue

        # 勾配の最大変化点
        gradient = np.abs(np.diff(profile))
        if len(gradient) == 0:
            borders[direction] = 1
            continue

        # 閾値以上の変化がある最初の位置
        threshold = np.max(gradient) * 0.3
        significant = np.where(gradient > threshold)[0]
        borders[direction] = int(significant[0]) + 1 if len(significant) > 0 else 1

    left = borders["left"]
    top = borders["top"]
    right = w - borders["right"]
    bottom = h - borders["bottom"]

    return (ox + left, oy + top, right - left, bottom - top)


def _detect_gold_border_inner(image: np.ndarray, outer_rect: tuple) -> tuple:
    """
    金ボーダーカード（ポケカUR等）のセンタリング検出。

    HSV色空間で金色の範囲を検出し、金ボーダー領域を特定する。
    """
    ox, oy, ow, oh = outer_rect
    roi = image[oy:oy+oh, ox:ox+ow]
    h, w = roi.shape[:2]

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    # 金色の範囲（HSV）: Hue 15-35, 高彩度、高輝度
    lower_gold = np.array([15, 80, 120])
    upper_gold = np.array([35, 255, 255])
    gold_mask = cv2.inRange(hsv, lower_gold, upper_gold)

    # モルフォロジーでノイズ除去
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    gold_mask = cv2.morphologyEx(gold_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    gold_mask = cv2.morphologyEx(gold_mask, cv2.MORPH_OPEN, kernel)

    # 金色でない領域 = 内部印刷領域
    inner_mask = cv2.bitwise_not(gold_mask)
    contours, _ = cv2.findContours(inner_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) > h * w * 0.3:
            bx, by, bw, bh = cv2.boundingRect(largest)
            return (ox + bx, oy + by, bw, bh)

    # フォールバック: 標準検出
    return _detect_inner_frame(image, outer_rect)


def _detect_thin_border_inner(image: np.ndarray, outer_rect: tuple) -> tuple:
    """
    薄ボーダーカード（ワンピSEC等）のセンタリング検出。

    ボーダーが通常より細いため、より細かいスキャンで境界を検出する。
    """
    ox, oy, ow, oh = outer_rect
    roi = image[oy:oy+oh, ox:ox+ow]
    h, w = roi.shape[:2]

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    # 細かいCannyエッジで薄ボーダーの境界線を検出
    edges = cv2.Canny(gray, 80, 200)

    # 四辺からスキャン（通常より狭い範囲 = 10%まで）
    max_scan = int(min(h, w) * 0.10)
    results = {}

    for direction in ["left", "right", "top", "bottom"]:
        densities = []

        if direction == "left":
            for col in range(max_scan):
                strip = edges[int(h*0.1):int(h*0.9), col]
                densities.append(np.mean(strip > 0))
        elif direction == "right":
            for col in range(w - 1, w - max_scan - 1, -1):
                strip = edges[int(h*0.1):int(h*0.9), col]
                densities.append(np.mean(strip > 0))
        elif direction == "top":
            for row in range(max_scan):
                strip = edges[row, int(w*0.1):int(w*0.9)]
                densities.append(np.mean(strip > 0))
        else:
            for row in range(h - 1, h - max_scan - 1, -1):
                strip = edges[row, int(w*0.1):int(w*0.9)]
                densities.append(np.mean(strip > 0))

        if not densities:
            results[direction] = 2
            continue

        # ピーク検出（ボーダーの境界線 = エッジ密度のピーク）
        smoothed = np.convolve(densities, np.ones(3) / 3, mode='valid')
        if len(smoothed) < 3:
            results[direction] = 2
            continue

        peak_idx = np.argmax(smoothed)
        results[direction] = peak_idx + 2  # +2: 平滑化オフセット

    left = results["left"]
    top = results["top"]
    right = w - results["right"]
    bottom = h - results["bottom"]

    if right <= left or bottom <= top:
        return _detect_inner_frame(image, outer_rect)

    return (ox + left, oy + top, right - left, bottom - top)


# ---------------------------------------------------------------------------
# ボーダー計算・スコアリング
# ---------------------------------------------------------------------------

def _compute_borders(outer_rect: tuple, inner_rect: tuple) -> dict:
    """外枠と内枠からボーダー幅を算出"""
    ox, oy, ow, oh = outer_rect
    ix, iy, iw, ih = inner_rect

    left = ix - ox
    right = (ox + ow) - (ix + iw)
    top = iy - oy
    bottom = (oy + oh) - (iy + ih)

    # 負の値（内枠が外枠をはみ出す場合）を補正
    left = max(left, 0)
    right = max(right, 0)
    top = max(top, 0)
    bottom = max(bottom, 0)

    return {
        "left": float(left),
        "right": float(right),
        "top": float(top),
        "bottom": float(bottom),
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


# ---------------------------------------------------------------------------
# オーバーレイ画像生成
# ---------------------------------------------------------------------------

def _generate_overlay(card_image: np.ndarray, outer_rect: tuple,
                      inner_rect: tuple, borders: dict) -> np.ndarray:
    """センタリング分析のオーバーレイ画像を生成"""
    overlay = card_image.copy()
    h, w = overlay.shape[:2]

    ox, oy, ow, oh = outer_rect
    ix, iy, iw, ih = inner_rect

    # 外枠を黄色で描画
    cv2.rectangle(overlay, (ox, oy), (ox + ow, oy + oh), (0, 255, 255), 2)

    # 内枠を緑で描画
    cv2.rectangle(overlay, (ix, iy), (ix + iw, iy + ih), (0, 255, 0), 2)

    # ボーダー領域を半透明で塗りつぶし
    border_overlay = overlay.copy()

    # 左ボーダー
    cv2.rectangle(border_overlay, (ox, oy), (ix, oy + oh), (255, 100, 100), -1)
    # 右ボーダー
    cv2.rectangle(border_overlay, (ix + iw, oy), (ox + ow, oy + oh), (255, 100, 100), -1)
    # 上ボーダー
    cv2.rectangle(border_overlay, (ox, oy), (ox + ow, iy), (100, 255, 100), -1)
    # 下ボーダー
    cv2.rectangle(border_overlay, (ox, iy + ih), (ox + ow, oy + oh), (100, 255, 100), -1)

    cv2.addWeighted(border_overlay, 0.25, overlay, 0.75, 0, overlay)

    # 外枠の中心
    outer_cx = ox + ow // 2
    outer_cy = oy + oh // 2
    # 内枠の中心
    inner_cx = ix + iw // 2
    inner_cy = iy + ih // 2

    # 中心点を描画
    cv2.circle(overlay, (outer_cx, outer_cy), 5, (0, 255, 255), -1)  # 外枠中心（黄）
    cv2.circle(overlay, (inner_cx, inner_cy), 5, (0, 255, 0), -1)    # 内枠中心（緑）

    # 中心のズレを矢印で表示
    cv2.arrowedLine(overlay, (outer_cx, outer_cy), (inner_cx, inner_cy),
                    (0, 0, 255), 2, tipLength=0.3)

    # 情報テキスト
    font = cv2.FONT_HERSHEY_SIMPLEX
    left = borders["left"]
    right = borders["right"]
    top = borders["top"]
    bottom = borders["bottom"]

    lr_total = left + right if (left + right) > 0 else 1
    tb_total = top + bottom if (top + bottom) > 0 else 1
    lr_pct = round(max(left, right) / lr_total * 100)
    tb_pct = round(max(top, bottom) / tb_total * 100)

    texts = [
        f"LR: {lr_pct}/{100-lr_pct}  (L:{left:.0f} R:{right:.0f})",
        f"TB: {tb_pct}/{100-tb_pct}  (T:{top:.0f} B:{bottom:.0f})",
    ]

    for i, text in enumerate(texts):
        y_pos = 25 + i * 25
        cv2.putText(overlay, text, (10, y_pos), font, 0.5, (0, 0, 0), 3)
        cv2.putText(overlay, text, (10, y_pos), font, 0.5, (255, 255, 255), 1)

    # 凡例
    legend_y = h - 30
    cv2.putText(overlay, "Yellow: Card Edge", (10, legend_y), font, 0.35, (0, 255, 255), 1)
    cv2.putText(overlay, "Green: Print Frame", (10, legend_y + 15), font, 0.35, (0, 255, 0), 1)

    return overlay
