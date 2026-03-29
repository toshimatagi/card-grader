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
    """カードの外枠を検出。前処理済み画像なので全体に近い。"""
    h, w = image.shape[:2]

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) > h * w * 0.3:
            return cv2.boundingRect(largest)

    margin_x = int(w * 0.02)
    margin_y = int(h * 0.02)
    return (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)


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
