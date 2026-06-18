"""センタリング分析モジュール（v6: 白ボーダー走査方式）

方針:
  v1: カード画像の端からの絶対距離でボーダーを測定 → 撮影角度に依存
  v2: 外枠と内枠の中心ズレで判定 → 内枠検出精度に依存
  v3: ブランドごとの既知ボーダー比率を「期待位置」として使い Canny エッジ探索
  v4: 分散ベース検出 → L:2 R:2 などの誤検出が頻発
  v5: Hough 直線変換 → フルフレーム写真で絵柄の辺を拾い TB=69/31 など外れ値多発
  v6: 白ボーダー走査方式 (White-border Scan)
      各辺から内側にピクセルを走査し「白 → 非白」の遷移点をボーダー境界とする。
      白判定: HSV で S<45 かつ V>160。
      中央 50% の帯を使うことで四隅のダメージ・丸みの影響を排除。
      検出結果が期待値の 25%〜400% 範囲外なら Hough フォールバック。
"""

import cv2
import numpy as np


def analyze_centering(card_image: np.ndarray, mode: str = "bordered",
                      border_ratios: dict | None = None,
                      outer_rect: tuple | None = None) -> dict:
    """
    カードのセンタリングを分析する。

    Args:
        card_image: 前処理済みカード画像
        mode: "bordered" | "borderless" | "gold_border" | "thin_border"
        border_ratios: ブランド既知ボーダー比率
            {"lr": 0.045, "top": 0.035, "bottom": 0.065}
        outer_rect: カード外枠 (x, y, w, h)。指定時は外枠再検出をスキップ。
            透視変換後の自動鑑定では (0, 0, img_w, img_h) を渡す。
    """
    h, w = card_image.shape[:2]

    # outer_rect が渡された場合は再検出をスキップ（透視変換後は不要）
    if outer_rect is None:
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
# v6: 白ボーダー走査方式（コア）+ v5 Hough フォールバック
# ---------------------------------------------------------------------------

def _detect_guided_inner(image: np.ndarray, outer_rect: tuple,
                         ratios: dict) -> tuple:
    """
    v6: 辺ごとに白ボーダー走査を試みる。
    走査範囲を「期待値の 30%〜280%」に限定し、範囲外は辺単位で Hough にフォールバック。
    これにより絵柄の白い領域への深入りを防ぎながら、金ボーダー等の非白辺も安全に処理。
    """
    ox, oy, ow, oh = (int(v) for v in outer_rect)
    roi = image[oy:oy + oh, ox:ox + ow]
    h, w = roi.shape[:2]
    if h < 40 or w < 40:
        return _ratio_fallback(ox, oy, ow, oh, ratios)

    exp_lr  = ratios.get("lr",     0.045)
    exp_top = ratios.get("top",    0.035)
    exp_bot = ratios.get("bottom", 0.065)

    # 白マスク・Canny エッジを一度だけ計算
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    white = ((hsv[:, :, 1] < 45) & (hsv[:, :, 2] > 160)).astype(np.float32)
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    edges_map = cv2.Canny(gray, 30, 100)

    expected_px = {
        "left":   exp_lr  * w,
        "right":  exp_lr  * w,
        "top":    exp_top * h,
        "bottom": exp_bot * h,
    }

    borders: dict[str, float] = {}
    for side in ("left", "right", "top", "bottom"):
        exp = expected_px[side]
        result = _scan_white_side(white, side, w, h, exp)
        if result is None:
            # この辺だけ Hough フォールバック
            result = _find_border_hough(edges_map, side, int(exp), w, h)
        borders[side] = float(result)

    left, right, top, bottom = (
        borders["left"], borders["right"],
        borders["top"],  borders["bottom"],
    )
    iw = w - int(left) - int(right)
    ih = h - int(top)  - int(bottom)
    if iw < w * 0.5 or ih < h * 0.5:
        return _ratio_fallback(ox, oy, ow, oh, ratios)

    return (ox + int(left), oy + int(top), iw, ih)


def _scan_white_side(white: np.ndarray, direction: str,
                     w: int, h: int, expected_px: float) -> float | None:
    """
    1辺の白ボーダー走査。
    走査範囲を expected_px の 30%〜280% に限定し、白→非白の遷移点を返す。
    走査開始位置が既に非白の場合（白ボーダーなしのカード）は None を返す。
    """
    threshold = 0.55  # 55% 以上が白 → まだボーダー内
    min_p = max(3, int(expected_px * 0.30))
    max_p = min(int(expected_px * 2.80), int(min(h, w) * 0.18))
    if min_p >= max_p:
        return None

    if direction == "left":
        mid = slice(h // 4, 3 * h // 4)
        saw_white = False
        for x in range(min_p, max_p):
            frac = np.mean(white[mid, x])
            if frac >= threshold:
                saw_white = True
            elif saw_white:
                return float(x)
        return None
    elif direction == "right":
        mid = slice(h // 4, 3 * h // 4)
        saw_white = False
        for x in range(w - min_p, w - max_p - 1, -1):
            frac = np.mean(white[mid, x])
            if frac >= threshold:
                saw_white = True
            elif saw_white:
                return float(w - x - 1)
        return None
    elif direction == "top":
        mid = slice(w // 4, 3 * w // 4)
        saw_white = False
        for y in range(min_p, max_p):
            frac = np.mean(white[y, mid])
            if frac >= threshold:
                saw_white = True
            elif saw_white:
                return float(y)
        return None
    else:  # bottom
        mid = slice(w // 4, 3 * w // 4)
        saw_white = False
        for y in range(h - min_p, h - max_p - 1, -1):
            frac = np.mean(white[y, mid])
            if frac >= threshold:
                saw_white = True
            elif saw_white:
                return float(h - y - 1)
        return None


def _ratio_fallback(ox: int, oy: int, ow: int, oh: int, ratios: dict) -> tuple:
    """ブランド既知比率でそのまま内枠を計算（最終フォールバック）"""
    lr  = int(ow * ratios.get("lr",     0.045))
    top = int(oh * ratios.get("top",    0.035))
    bot = int(oh * ratios.get("bottom", 0.065))
    return (ox + lr, oy + top, ow - 2 * lr, oh - top - bot)


def _find_border_hough(edges: np.ndarray, direction: str,
                       expected: int, w: int, h: int) -> float:
    """
    Hough 直線変換でボーダー境界線の位置を検出する。

    期待位置 ±70% の探索範囲内で、辺の 35% 以上を横断する直線を探す。
    複数候補がある場合は外縁に最も近い線（最小ボーダー幅）を採用。
    適格な直線が見つからない場合は expected を返す（安定フォールバック）。

    Args:
        edges: Canny エッジ画像（ROI 内座標）
        direction: "top" | "bottom" | "left" | "right"
        expected: 期待ボーダー幅（ピクセル）
        w, h: ROI の幅・高さ
    """
    search_min = max(2, int(expected * 0.30))
    search_max = min(int(expected * 1.70), int(min(w, h) * 0.25))
    if search_max <= search_min:
        return float(expected)

    is_horizontal = direction in ("top", "bottom")
    perp = w if is_horizontal else h          # ボーダー線が走る方向の長さ
    min_length = int(perp * 0.35)             # 辺の 35% 以上の線を対象
    max_gap = int(perp * 0.12)                # 12% のギャップまで繋ぐ
    angle_tol = max(3, int(perp * 0.015))     # 1.5% 以内の角度ずれを許容

    # 探索領域を切り出し（絶対座標オフセットを記録）
    if direction == "top":
        region = edges[search_min:search_max + 1, :]
        region_offset = search_min
    elif direction == "bottom":
        start_row = max(0, h - search_max - 1)
        region = edges[start_row:h - search_min, :]
        region_offset = start_row
    elif direction == "left":
        region = edges[:, search_min:search_max + 1]
        region_offset = search_min
    else:  # right
        start_col = max(0, w - search_max - 1)
        region = edges[:, start_col:w - search_min]
        region_offset = start_col

    if region.size == 0:
        return float(expected)

    lines = cv2.HoughLinesP(
        region,
        rho=1,
        theta=np.pi / 180,
        threshold=max(8, min_length // 4),
        minLineLength=min_length,
        maxLineGap=max_gap,
    )

    if lines is None:
        return float(expected)

    best: float | None = None

    for line in lines:
        x1, y1, x2, y2 = line[0]

        if is_horizontal:
            if abs(y1 - y2) > angle_tol:
                continue  # 水平でない
            abs_y = (y1 + y2) / 2.0 + region_offset
            border_dist = abs_y if direction == "top" else h - abs_y
        else:
            if abs(x1 - x2) > angle_tol:
                continue  # 垂直でない
            abs_x = (x1 + x2) / 2.0 + region_offset
            border_dist = abs_x if direction == "left" else w - abs_x

        # 期待値に最も近い線を採用（外縁ではなくボーダー→アート境界を狙う）
        if best is None or abs(border_dist - expected) < abs(best - expected):
            best = border_dist

    if best is None:
        return float(expected)

    # サニティチェック: 期待値の 3 倍以上ずれたら expected を返す
    if abs(best - expected) > expected * 2.0:
        return float(expected)

    return float(best)


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

    ox, oy, ow, oh = (int(v) for v in outer_rect)
    ix, iy, iw, ih = (int(v) for v in inner_rect)

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
