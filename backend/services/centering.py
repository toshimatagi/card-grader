"""センタリング分析モジュール（v3: ブランド既知ボーダー比率ガイド方式）

方針:
  v1: カード画像の端からの絶対距離でボーダーを測定 → 撮影角度に依存
  v2: 外枠と内枠の中心ズレで判定 → 内枠検出精度に依存
  v3: ブランドごとの既知ボーダー比率を「期待位置」として使い、
      その周辺でエッジを精密探索 → 安定性が大幅に向上
"""

import cv2
import numpy as np


def analyze_centering(card_image: np.ndarray, mode: str = "bordered",
                      border_ratios: dict | None = None) -> dict:
    """
    カードのセンタリングを分析する。

    Args:
        card_image: 前処理済みカード画像
        mode: "bordered" | "borderless" | "gold_border" | "thin_border"
        border_ratios: ブランド既知ボーダー比率
            {"lr": 0.045, "top": 0.035, "bottom": 0.065}
    """
    h, w = card_image.shape[:2]

    # カード外縁の矩形
    outer_rect = _detect_outer_boundary(card_image)

    if mode == "borderless":
        inner_rect = _detect_borderless_inner(card_image, outer_rect)
    elif border_ratios:
        # v3: 既知比率ガイド方式（bordered / gold_border / thin_border 共通）
        inner_rect = _detect_guided_inner(card_image, outer_rect, border_ratios)
    else:
        # フォールバック: 既知比率なしの場合デフォルト比率を使用
        default_ratios = {"lr": 0.045, "top": 0.035, "bottom": 0.065}
        inner_rect = _detect_guided_inner(card_image, outer_rect, default_ratios)

    borders = _compute_borders(outer_rect, inner_rect)

    left = borders["left"]
    right = borders["right"]
    top = borders["top"]
    bottom = borders["bottom"]

    lr_total = left + right if (left + right) > 0 else 1
    tb_total = top + bottom if (top + bottom) > 0 else 1

    lr_pct_larger = round(max(left, right) / lr_total * 100)
    lr_pct_smaller = 100 - lr_pct_larger
    tb_pct_larger = round(max(top, bottom) / tb_total * 100)
    tb_pct_smaller = 100 - tb_pct_larger

    lr_ratio = f"{lr_pct_larger}/{lr_pct_smaller}"
    tb_ratio = f"{tb_pct_larger}/{tb_pct_smaller}"

    max_deviation = max(lr_pct_larger, tb_pct_larger)
    score = _calculate_score(max_deviation)

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
    カードの外枠を検出。背景が残っている場合も正確に検出する。

    3つの方法を試し、最も妥当な結果を採用:
      1. エッジベース: Cannyエッジで最大矩形輪郭を検出
      2. 四辺スキャン: 各辺から走査して明度変化点を検出
      3. 背景色マスク: 四隅の色を背景として除外
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    results = []

    # --- 方法1: エッジベースの矩形検出 ---
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 30, 100)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=2)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) > h * w * 0.3:
            results.append(cv2.boundingRect(largest))

    # --- 方法2: 四辺からの明度変化スキャン ---
    scan_result = _scan_card_edges(gray)
    if scan_result:
        results.append(scan_result)

    # --- 方法3: 背景色マスク ---
    bg_result = _detect_by_background_mask(image)
    if bg_result:
        results.append(bg_result)

    if not results:
        margin_x = int(w * 0.02)
        margin_y = int(h * 0.02)
        return (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)

    # 結果が複数ある場合、最も「内側」（タイトな）結果を採用
    # = 背景を含まない最もタイトなバウンディングボックス
    best = max(results, key=lambda r: _boundary_quality(r, w, h))
    return best


def _scan_card_edges(gray: np.ndarray) -> tuple | None:
    """四辺から走査して明度の急変点（カード端）を検出"""
    h, w = gray.shape
    max_scan = int(min(h, w) * 0.2)
    edges = {}

    for direction in ["left", "right", "top", "bottom"]:
        profiles = []
        if direction == "left":
            for y in range(int(h * 0.3), int(h * 0.7), max(1, h // 8)):
                profiles.append(gray[y, :max_scan].astype(float))
        elif direction == "right":
            for y in range(int(h * 0.3), int(h * 0.7), max(1, h // 8)):
                profiles.append(gray[y, w - max_scan:][::-1].astype(float))
        elif direction == "top":
            for x in range(int(w * 0.3), int(w * 0.7), max(1, w // 8)):
                profiles.append(gray[:max_scan, x].astype(float))
        else:
            for x in range(int(w * 0.3), int(w * 0.7), max(1, w // 8)):
                profiles.append(gray[h - max_scan:, x][::-1].astype(float))

        positions = []
        for profile in profiles:
            if len(profile) < 5:
                continue
            gradient = np.abs(np.diff(profile))
            if len(gradient) == 0:
                continue
            threshold = np.mean(gradient) + 2 * np.std(gradient)
            if threshold < 5:
                continue
            peaks = np.where(gradient > threshold)[0]
            if len(peaks) > 0:
                positions.append(int(peaks[0]))

        edges[direction] = int(np.median(positions)) if positions else 0

    left = edges["left"]
    top = edges["top"]
    right = w - edges["right"]
    bottom = h - edges["bottom"]

    if right - left < w * 0.5 or bottom - top < h * 0.5:
        return None

    return (left, top, right - left, bottom - top)


def _detect_by_background_mask(image: np.ndarray) -> tuple | None:
    """四隅のピクセルを背景色とし、それと異なる領域をカードとして検出"""
    h, w = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    corner_size = max(5, int(min(h, w) * 0.03))
    corners = np.vstack([
        hsv[:corner_size, :corner_size, :].reshape(-1, 3),
        hsv[:corner_size, w - corner_size:, :].reshape(-1, 3),
        hsv[h - corner_size:, :corner_size, :].reshape(-1, 3),
        hsv[h - corner_size:, w - corner_size:, :].reshape(-1, 3),
    ])

    bg_h = np.median(corners[:, 0])
    bg_s = np.median(corners[:, 1])
    bg_v = np.median(corners[:, 2])

    hue_diff = np.abs(hsv[:, :, 0].astype(float) - bg_h)
    hue_diff = np.minimum(hue_diff, 180 - hue_diff)
    sat_diff = np.abs(hsv[:, :, 1].astype(float) - bg_s)
    val_diff = np.abs(hsv[:, :, 2].astype(float) - bg_v)

    card_mask = ((hue_diff > 15) | (sat_diff > 40) | (val_diff > 40)).astype(np.uint8) * 255

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    card_mask = cv2.morphologyEx(card_mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    card_mask = cv2.morphologyEx(card_mask, cv2.MORPH_OPEN, kernel, iterations=2)

    coords = cv2.findNonZero(card_mask)
    if coords is None or len(coords) < 100:
        return None

    bx, by, bw, bh = cv2.boundingRect(coords)
    if bw < w * 0.5 or bh < h * 0.5:
        return None

    return (bx, by, bw, bh)


def _boundary_quality(rect: tuple, img_w: int, img_h: int) -> float:
    """外枠検出結果の品質スコア。カードのアスペクト比に近く、適度なサイズが高スコア。"""
    x, y, rw, rh = rect
    if rw == 0 or rh == 0:
        return 0

    # カードのアスペクト比 (0.714) に近いほど高スコア
    aspect = min(rw, rh) / max(rw, rh)
    aspect_score = 1.0 - abs(aspect - 0.714) * 3

    # 画像面積の50-95%が理想
    area_ratio = (rw * rh) / (img_w * img_h)
    if area_ratio > 0.95:
        area_score = 0.5  # 画像全体≒背景含む
    elif area_ratio > 0.5:
        area_score = 1.0
    else:
        area_score = area_ratio * 2

    return aspect_score * area_score


# ---------------------------------------------------------------------------
# v3: 既知ボーダー比率ガイド方式（コア）
# ---------------------------------------------------------------------------

def _detect_guided_inner(image: np.ndarray, outer_rect: tuple,
                         ratios: dict) -> tuple:
    """
    ブランドの既知ボーダー比率を「期待位置」として使い、
    その周辺±50%の範囲でエッジを精密探索する。

    1. 期待ボーダー幅を計算（例: ワンピの左右は幅の3.8%）
    2. その位置の周辺でCannyエッジの密度変化を探索
    3. エッジが見つかればその位置を採用、なければ期待位置をそのまま使用

    これにより:
    - CV検出が成功 → 実際のボーダー位置を正確に取得
    - CV検出が失敗 → 既知比率に基づく安定した結果
    """
    ox, oy, ow, oh = outer_rect
    roi = image[oy:oy+oh, ox:ox+ow]
    rh, rw = roi.shape[:2]

    # 期待ボーダー幅（ピクセル）
    expected_lr = int(rw * ratios["lr"])
    expected_top = int(rh * ratios["top"])
    expected_bottom = int(rh * ratios["bottom"])

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    # 各辺のボーダー幅を精密検出
    left_border = _refine_border(edges, "left", expected_lr, rw, rh)
    right_border = _refine_border(edges, "right", expected_lr, rw, rh)
    top_border = _refine_border(edges, "top", expected_top, rw, rh)
    bottom_border = _refine_border(edges, "bottom", expected_bottom, rw, rh)

    ix = ox + left_border
    iy = oy + top_border
    iw = ow - left_border - right_border
    ih = oh - top_border - bottom_border

    # サニティチェック
    if iw < ow * 0.5 or ih < oh * 0.5:
        # 検出結果がおかしい場合は期待値をそのまま使用
        return (ox + expected_lr, oy + expected_top,
                ow - 2 * expected_lr, oh - expected_top - expected_bottom)

    return (ix, iy, iw, ih)


def _refine_border(edges: np.ndarray, direction: str,
                   expected: int, w: int, h: int) -> int:
    """
    期待位置の周辺でエッジを探索し、ボーダー幅を精密に決定する。

    探索範囲: expected * 0.5 ~ expected * 1.5
    """
    search_min = max(2, int(expected * 0.5))
    search_max = min(int(expected * 1.5), int(min(w, h) * 0.15))

    if search_max <= search_min:
        return expected

    # 探索範囲のエッジ密度プロファイルを取得
    densities = []

    for pos in range(search_min, search_max + 1):
        if direction == "left":
            # 左辺: 縦方向の中央60%を使用
            y_start, y_end = int(h * 0.2), int(h * 0.8)
            strip = edges[y_start:y_end, pos]
        elif direction == "right":
            col = w - 1 - pos
            y_start, y_end = int(h * 0.2), int(h * 0.8)
            strip = edges[y_start:y_end, col]
        elif direction == "top":
            x_start, x_end = int(w * 0.2), int(w * 0.8)
            strip = edges[pos, x_start:x_end]
        else:  # bottom
            row = h - 1 - pos
            x_start, x_end = int(w * 0.2), int(w * 0.8)
            strip = edges[row, x_start:x_end]

        density = np.mean(strip > 0) if len(strip) > 0 else 0
        densities.append(density)

    if not densities:
        return expected

    densities = np.array(densities)

    # エッジ密度が最大の位置 = ボーダーと内部の境界線
    # ただし、期待位置に近い方を優先（重み付き）
    weights = np.ones(len(densities))
    expected_idx = expected - search_min
    if 0 <= expected_idx < len(densities):
        # 期待位置からの距離に応じて重みを減衰
        for i in range(len(weights)):
            dist = abs(i - expected_idx)
            weights[i] = 1.0 / (1.0 + dist * 0.3)

    weighted = densities * weights

    # 閾値以上のエッジ密度がある位置を探す
    threshold = np.max(densities) * 0.4
    candidates = np.where(densities > threshold)[0]

    if len(candidates) == 0:
        return expected

    # 期待位置に最も近い候補を選択
    best_idx = candidates[np.argmin(np.abs(candidates - expected_idx))]
    result = search_min + best_idx

    return result


# ---------------------------------------------------------------------------
# ボーダーレスカード検出
# ---------------------------------------------------------------------------

def _detect_borderless_inner(image: np.ndarray, outer_rect: tuple) -> tuple:
    """ボーダーレス/フルアートカードのセンタリング検出。"""
    ox, oy, ow, oh = outer_rect
    roi = image[oy:oy+oh, ox:ox+ow]
    h, w = roi.shape[:2]

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

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

        if len(profile) < 3:
            borders[direction] = 1
            continue

        gradient = np.abs(np.diff(profile))
        if len(gradient) == 0:
            borders[direction] = 1
            continue

        threshold = np.max(gradient) * 0.3
        significant = np.where(gradient > threshold)[0]
        borders[direction] = int(significant[0]) + 1 if len(significant) > 0 else 1

    left = borders["left"]
    top = borders["top"]
    right = w - borders["right"]
    bottom = h - borders["bottom"]

    return (ox + left, oy + top, right - left, bottom - top)


# ---------------------------------------------------------------------------
# ボーダー計算・スコアリング
# ---------------------------------------------------------------------------

def _compute_borders(outer_rect: tuple, inner_rect: tuple) -> dict:
    """外枠と内枠からボーダー幅を算出"""
    ox, oy, ow, oh = outer_rect
    ix, iy, iw, ih = inner_rect

    left = max(ix - ox, 0)
    right = max((ox + ow) - (ix + iw), 0)
    top = max(iy - oy, 0)
    bottom = max((oy + oh) - (iy + ih), 0)

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
    cv2.rectangle(border_overlay, (ox, oy), (ix, oy + oh), (255, 100, 100), -1)
    cv2.rectangle(border_overlay, (ix + iw, oy), (ox + ow, oy + oh), (255, 100, 100), -1)
    cv2.rectangle(border_overlay, (ox, oy), (ox + ow, iy), (100, 255, 100), -1)
    cv2.rectangle(border_overlay, (ox, iy + ih), (ox + ow, oy + oh), (100, 255, 100), -1)
    cv2.addWeighted(border_overlay, 0.25, overlay, 0.75, 0, overlay)

    # 中心点
    outer_cx = ox + ow // 2
    outer_cy = oy + oh // 2
    inner_cx = ix + iw // 2
    inner_cy = iy + ih // 2

    cv2.circle(overlay, (outer_cx, outer_cy), 5, (0, 255, 255), -1)
    cv2.circle(overlay, (inner_cx, inner_cy), 5, (0, 255, 0), -1)
    cv2.arrowedLine(overlay, (outer_cx, outer_cy), (inner_cx, inner_cy),
                    (0, 0, 255), 2, tipLength=0.3)

    # テキスト
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

    legend_y = h - 30
    cv2.putText(overlay, "Yellow: Card Edge", (10, legend_y), font, 0.35, (0, 255, 255), 1)
    cv2.putText(overlay, "Green: Print Frame", (10, legend_y + 15), font, 0.35, (0, 255, 0), 1)

    return overlay
