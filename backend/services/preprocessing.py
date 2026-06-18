"""カード領域検出・前処理モジュール（v3: 辺ごと独立余白除去）

改善点:
  - 3つの検出手法（エッジ/色差/適応的閾値）のアンサンブル
  - 背景色の自動検出と除去
  - 検出後のタイトクロップ（余白の完全除去）
  - 正面化後にカード外縁を再検出して最終トリミング
  - v3: _trim_margins を辺ごと独立サンプリング方式に変更
    → 1辺だけ背景が残るケース (混合平均問題) を正確に処理
"""

import cv2
import numpy as np


def order_points(pts: np.ndarray) -> np.ndarray:
    """4点を左上、右上、右下、左下の順に並び替える"""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    d = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(d)]
    rect[3] = pts[np.argmax(d)]
    return rect


def detect_card(image: np.ndarray, trim: bool = True) -> dict:
    """
    画像からカード領域を検出し、正面化した画像を返す。

    検出パイプライン:
      1. 3手法でカード候補を検出
      2. 最もスコアの高い候補を採用
      3. ホモグラフィ変換で正面化
      4. trim=True の場合、正面化後に余白を再トリミング

    Args:
        image: 入力画像
        trim: Trueなら余白トリミングを実行、Falseなら正面化のみ
    """
    h, w = image.shape[:2]

    # 3つの手法でカード領域を検出
    candidates = []

    c1 = _detect_by_edge(image)
    if c1 is not None:
        candidates.append(c1)

    c2 = _detect_by_background_color(image)
    if c2 is not None:
        candidates.append(c2)

    c3 = _detect_by_adaptive_threshold(image)
    if c3 is not None:
        candidates.append(c3)

    if not candidates:
        return _fallback_full_image(image)

    # 最良の候補を選択（面積が大きく、矩形度が高いもの）
    best = max(candidates, key=lambda c: c["score"])
    card_corners = best["corners"]
    card_contour = best.get("contour")

    # 4点を順序化
    ordered = order_points(card_corners.astype(np.float32))

    # 出力サイズの計算
    width_top = np.linalg.norm(ordered[1] - ordered[0])
    width_bottom = np.linalg.norm(ordered[2] - ordered[3])
    max_width = int(max(width_top, width_bottom))

    height_left = np.linalg.norm(ordered[3] - ordered[0])
    height_right = np.linalg.norm(ordered[2] - ordered[1])
    max_height = int(max(height_left, height_right))

    max_width = max(max_width, 300)
    max_height = max(max_height, 420)

    # ホモグラフィ変換で正面化
    dst = np.array([
        [0, 0], [max_width - 1, 0],
        [max_width - 1, max_height - 1], [0, max_height - 1]
    ], dtype="float32")

    matrix = cv2.getPerspectiveTransform(ordered, dst)
    card_image = cv2.warpPerspective(image, matrix, (max_width, max_height))

    # --- 正面化後の余白トリミング（trim=True の場合のみ） ---
    if trim:
        card_image = _trim_margins(card_image)

    aspect_ratio = card_image.shape[1] / card_image.shape[0]
    card_type = _estimate_card_type(aspect_ratio)

    return {
        "card_image": card_image,
        "contour": card_contour,
        "corners": ordered,
        "card_type": card_type,
        "original_size": (h, w),
    }


# ---------------------------------------------------------------------------
# 検出手法1: エッジベース
# ---------------------------------------------------------------------------

def _detect_by_edge(image: np.ndarray) -> dict | None:
    """Cannyエッジ → 4角形の輪郭検出"""
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # 複数の閾値でエッジ検出を試す
    for low, high in [(30, 150), (50, 200), (20, 100)]:
        edges = cv2.Canny(blurred, low, high)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=2)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue

        contours = sorted(contours, key=cv2.contourArea, reverse=True)

        for contour in contours[:5]:
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

            if len(approx) == 4:
                area = cv2.contourArea(approx)
                if area > (h * w * 0.1):
                    rect_area = cv2.minAreaRect(approx)
                    box_area = rect_area[1][0] * rect_area[1][1]
                    rectangularity = area / max(box_area, 1)
                    score = (area / (h * w)) * rectangularity
                    return {
                        "corners": approx.reshape(4, 2),
                        "contour": contour,
                        "score": score,
                    }

    return None


# ---------------------------------------------------------------------------
# 検出手法2: 背景色の除去
# ---------------------------------------------------------------------------

def _detect_by_background_color(image: np.ndarray) -> dict | None:
    """
    画像四辺のピクセルを背景色としてサンプリングし、
    背景色でない領域をカードとして検出。
    """
    h, w = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # 四辺の端2%をサンプリングして背景色を推定
    border = max(5, int(min(h, w) * 0.02))
    bg_samples = np.vstack([
        hsv[:border, :, :].reshape(-1, 3),
        hsv[h - border:, :, :].reshape(-1, 3),
        hsv[:, :border, :].reshape(-1, 3),
        hsv[:, w - border:, :].reshape(-1, 3),
    ])

    bg_h = np.median(bg_samples[:, 0])
    bg_s = np.median(bg_samples[:, 1])
    bg_v = np.median(bg_samples[:, 2])

    # 背景色に近いピクセルのマスク
    h_diff = np.abs(hsv[:, :, 0].astype(float) - bg_h)
    h_diff = np.minimum(h_diff, 180 - h_diff)
    s_diff = np.abs(hsv[:, :, 1].astype(float) - bg_s)
    v_diff = np.abs(hsv[:, :, 2].astype(float) - bg_v)

    bg_mask = ((h_diff < 25) & (s_diff < 50) & (v_diff < 50)).astype(np.uint8) * 255

    # 背景でない領域 = カード領域
    card_mask = cv2.bitwise_not(bg_mask)

    # モルフォロジー処理でノイズ除去
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    card_mask = cv2.morphologyEx(card_mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    card_mask = cv2.morphologyEx(card_mask, cv2.MORPH_OPEN, kernel, iterations=2)

    contours, _ = cv2.findContours(card_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    if area < h * w * 0.1:
        return None

    # 4角形に近似
    peri = cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, 0.02 * peri, True)

    if len(approx) == 4:
        corners = approx.reshape(4, 2)
    else:
        # 最小外接矩形にフォールバック
        rect = cv2.minAreaRect(largest)
        corners = cv2.boxPoints(rect).astype(np.float32)

    rectangularity = area / max(cv2.contourArea(cv2.convexHull(largest)), 1)
    score = (area / (h * w)) * rectangularity * 0.95  # エッジ検出より少し低めの重み

    return {
        "corners": corners,
        "contour": largest,
        "score": score,
    }


# ---------------------------------------------------------------------------
# 検出手法3: 適応的閾値
# ---------------------------------------------------------------------------

def _detect_by_adaptive_threshold(image: np.ndarray) -> dict | None:
    """Otsu + 適応的閾値でカード領域を検出"""
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)

    # Otsuの二値化
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # 反転版も試す（暗い背景/明るい背景の両対応）
    for mask in [binary, cv2.bitwise_not(binary)]:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue

        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        if area < h * w * 0.1:
            continue

        peri = cv2.arcLength(largest, True)
        approx = cv2.approxPolyDP(largest, 0.02 * peri, True)

        if 4 <= len(approx) <= 6:
            if len(approx) == 4:
                corners = approx.reshape(4, 2)
            else:
                rect = cv2.minAreaRect(largest)
                corners = cv2.boxPoints(rect).astype(np.float32)

            rectangularity = area / max(cv2.contourArea(cv2.convexHull(largest)), 1)
            score = (area / (h * w)) * rectangularity * 0.9

            return {
                "corners": corners,
                "contour": largest,
                "score": score,
            }

    return None


# ---------------------------------------------------------------------------
# 正面化後の余白トリミング
# ---------------------------------------------------------------------------

def _trim_margins(card_image: np.ndarray) -> np.ndarray:
    """
    正面化後の画像から残存する余白（背景）を除去する。

    v3: 辺ごと独立サンプリング方式。
    旧実装は4辺を合算平均していたため、1辺だけ背景が残る場合に
    混合平均が生じて検出が壊れていた。各辺を独立に処理することで
    「右辺だけ紫背景が残る」等のケースを正確に検出できる。
    """
    h, w = card_image.shape[:2]
    if h < 50 or w < 50:
        return card_image

    hsv = cv2.cvtColor(card_image, cv2.COLOR_BGR2HSV).astype(float)
    sample_px = max(5, int(min(h, w) * 0.03))   # 外側 3% をサンプル
    scan_px = int(min(h, w) * 0.20)              # 最大 20% まで走査

    crop = {"top": 0, "bottom": h, "left": 0, "right": w}

    for direction in ("top", "bottom", "left", "right"):
        # 辺ごとに外側 3% をサンプリングして背景色を独立推定
        if direction == "top":
            samp = hsv[:sample_px, :, :]
        elif direction == "bottom":
            samp = hsv[h - sample_px:, :, :]
        elif direction == "left":
            samp = hsv[:, :sample_px, :]
        else:
            samp = hsv[:, w - sample_px:, :]

        flat = samp.reshape(-1, 3)
        bg_h = float(np.median(flat[:, 0]))
        bg_s = float(np.median(flat[:, 1]))
        bg_v = float(np.median(flat[:, 2]))

        # サンプルが白っぽい (S≤25 かつ V≥200) = カード自身の白ボーダー
        # → この辺は背景なし、トリミング不要
        if bg_s <= 25 and bg_v >= 200:
            continue

        # 背景ピクセルマスク（全画素を対象）
        hue_diff = np.abs(hsv[:, :, 0] - bg_h)
        hue_diff = np.minimum(hue_diff, 180.0 - hue_diff)
        is_bg = (
            (hue_diff < 22) &
            (np.abs(hsv[:, :, 1] - bg_s) < 45) &
            (np.abs(hsv[:, :, 2] - bg_v) < 45)
        )

        # 背景が終わる行/列を内側に向かって走査
        # 行/列の 50% 以上が背景色でなくなった点 = カード開始
        if direction == "top":
            for y in range(min(scan_px, h)):
                if np.mean(is_bg[y, :]) < 0.50:
                    crop["top"] = y
                    break
        elif direction == "bottom":
            for y in range(h - 1, max(h - scan_px - 1, 0), -1):
                if np.mean(is_bg[y, :]) < 0.50:
                    crop["bottom"] = y + 1
                    break
        elif direction == "left":
            for x in range(min(scan_px, w)):
                if np.mean(is_bg[:, x]) < 0.50:
                    crop["left"] = x
                    break
        else:
            for x in range(w - 1, max(w - scan_px - 1, 0), -1):
                if np.mean(is_bg[:, x]) < 0.50:
                    crop["right"] = x + 1
                    break

    t, b, l, r = crop["top"], crop["bottom"], crop["left"], crop["right"]

    # 過剰トリミング防止（元サイズの 50% 以上を保持）
    if (r - l) < w * 0.50 or (b - t) < h * 0.50:
        return card_image

    trimmed = card_image[t:b, l:r]
    if trimmed.shape[0] < 100 or trimmed.shape[1] < 70:
        return card_image
    return trimmed


def find_card_bbox_in_normalized(card_image: np.ndarray) -> dict:
    """正面化済み画像内のカード境界を 0-1 比率の bbox で返す。

    preprocess (trim=False) 後の画像はカード矩形に近いが、わずかに背景や
    歪みが残ることがある。各辺から走査してカード端を探し、CenteringEditor の
    外枠初期値として使える bbox を返す。
    """
    h, w = card_image.shape[:2]
    if h == 0 or w == 0:
        return {"left": 0.0, "right": 1.0, "top": 0.0, "bottom": 1.0}
    try:
        gray = cv2.cvtColor(card_image, cv2.COLOR_BGR2GRAY)
    except cv2.error:
        return {"left": 0.0, "right": 1.0, "top": 0.0, "bottom": 1.0}
    max_depth = max(int(min(h, w) * 0.10), 8)
    left_off = _find_edge_from_side(gray, "left", max_depth)
    right_off = _find_edge_from_side(gray, "right", max_depth)
    top_off = _find_edge_from_side(gray, "top", max_depth)
    bottom_off = _find_edge_from_side(gray, "bottom", max_depth)
    return {
        "left": left_off / w,
        "right": (w - 1 - right_off) / w,
        "top": top_off / h,
        "bottom": (h - 1 - bottom_off) / h,
    }


def _find_edge_from_side(gray: np.ndarray, direction: str, max_depth: int) -> int:
    """指定方向から走査して、明度の大きな変化点（カード境界）を検出"""
    h, w = gray.shape

    profiles = []
    if direction == "top":
        for x in range(int(w * 0.3), int(w * 0.7), max(1, w // 10)):
            profiles.append(gray[:max_depth, x].astype(float))
    elif direction == "bottom":
        for x in range(int(w * 0.3), int(w * 0.7), max(1, w // 10)):
            profiles.append(gray[h - max_depth:, x][::-1].astype(float))
    elif direction == "left":
        for y in range(int(h * 0.3), int(h * 0.7), max(1, h // 10)):
            profiles.append(gray[y, :max_depth].astype(float))
    elif direction == "right":
        for y in range(int(h * 0.3), int(h * 0.7), max(1, h // 10)):
            profiles.append(gray[y, w - max_depth:][::-1].astype(float))

    if not profiles:
        return 0

    # 各プロファイルの勾配最大点を検出
    edge_positions = []
    for profile in profiles:
        if len(profile) < 5:
            continue
        # 移動平均で平滑化
        smoothed = np.convolve(profile, np.ones(3) / 3, mode='valid')
        gradient = np.abs(np.diff(smoothed))
        if len(gradient) == 0:
            continue
        threshold = np.mean(gradient) + 2 * np.std(gradient)
        peaks = np.where(gradient > threshold)[0]
        if len(peaks) > 0:
            edge_positions.append(peaks[0] + 2)  # +2 for convolution offset

    if edge_positions:
        return int(np.median(edge_positions))
    return 0


# ---------------------------------------------------------------------------
# ユーティリティ
# ---------------------------------------------------------------------------

def _fallback_full_image(image: np.ndarray) -> dict:
    """輪郭が見つからない場合のフォールバック"""
    h, w = image.shape[:2]
    margin = int(min(h, w) * 0.02)
    card_image = image[margin:h - margin, margin:w - margin]
    card_image = _trim_margins(card_image)  # トリミングも適用
    aspect_ratio = card_image.shape[1] / card_image.shape[0]
    return {
        "card_image": card_image,
        "contour": None,
        "corners": np.array([[margin, margin], [w - margin, margin],
                             [w - margin, h - margin], [margin, h - margin]], dtype="float32"),
        "card_type": _estimate_card_type(aspect_ratio),
        "original_size": (h, w),
    }


def _estimate_card_type(aspect_ratio: float) -> str:
    """アスペクト比からカードタイプを推定"""
    if abs(aspect_ratio - 0.716) < 0.05:
        return "standard"
    elif abs(aspect_ratio - 0.686) < 0.05:
        return "small"
    return "standard"
