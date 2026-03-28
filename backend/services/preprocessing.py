"""カード領域検出・前処理モジュール"""

import cv2
import numpy as np


def order_points(pts: np.ndarray) -> np.ndarray:
    """4点を左上、右上、右下、左下の順に並び替える"""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # 左上
    rect[2] = pts[np.argmax(s)]   # 右下
    d = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(d)]   # 右上
    rect[3] = pts[np.argmax(d)]   # 左下
    return rect


def detect_card(image: np.ndarray) -> dict:
    """
    画像からカード領域を検出し、正面化した画像を返す。

    Returns:
        dict with keys:
        - card_image: 正面化されたカード画像
        - contour: 検出された輪郭
        - corners: 4隅の座標
        - card_type: 推定カードタイプ
    """
    h, w = image.shape[:2]

    # グレースケール化
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # ブラー適用してノイズ除去
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # エッジ検出
    edges = cv2.Canny(blurred, 30, 150)

    # 膨張処理でエッジを繋げる
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=2)

    # 輪郭検出
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        # 輪郭が見つからない場合は画像全体をカードとして扱う
        return _fallback_full_image(image)

    # 面積が最大の輪郭を選択
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    card_contour = None
    card_corners = None

    for contour in contours[:5]:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

        # 4角形に近い輪郭を探す
        if len(approx) == 4:
            area = cv2.contourArea(approx)
            if area > (h * w * 0.05):  # 画像の5%以上の面積
                card_contour = contour
                card_corners = approx.reshape(4, 2)
                break

    if card_corners is None:
        # 4角形が見つからない場合、最大輪郭の外接矩形を使用
        largest = contours[0]
        area = cv2.contourArea(largest)
        if area > (h * w * 0.05):
            rect = cv2.minAreaRect(largest)
            box = cv2.boxPoints(rect)
            card_corners = box.astype(np.float32)
            card_contour = largest
        else:
            return _fallback_full_image(image)

    # 4点を順序化
    ordered = order_points(card_corners.astype(np.float32))

    # 出力サイズの計算
    width_top = np.linalg.norm(ordered[1] - ordered[0])
    width_bottom = np.linalg.norm(ordered[2] - ordered[3])
    max_width = int(max(width_top, width_bottom))

    height_left = np.linalg.norm(ordered[3] - ordered[0])
    height_right = np.linalg.norm(ordered[2] - ordered[1])
    max_height = int(max(height_left, height_right))

    # 最小サイズを保証
    max_width = max(max_width, 300)
    max_height = max(max_height, 420)

    # ホモグラフィ変換で正面化
    dst = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1]
    ], dtype="float32")

    matrix = cv2.getPerspectiveTransform(ordered, dst)
    card_image = cv2.warpPerspective(image, matrix, (max_width, max_height))

    # カードタイプの推定（アスペクト比から）
    aspect_ratio = max_width / max_height
    card_type = _estimate_card_type(aspect_ratio)

    return {
        "card_image": card_image,
        "contour": card_contour,
        "corners": ordered,
        "card_type": card_type,
        "original_size": (h, w),
    }


def _fallback_full_image(image: np.ndarray) -> dict:
    """輪郭が見つからない場合のフォールバック: 画像全体をカードとして扱う"""
    h, w = image.shape[:2]
    # 少しマージンを削って使用
    margin = int(min(h, w) * 0.02)
    card_image = image[margin:h-margin, margin:w-margin]
    aspect_ratio = card_image.shape[1] / card_image.shape[0]
    return {
        "card_image": card_image,
        "contour": None,
        "corners": np.array([[margin, margin], [w-margin, margin],
                             [w-margin, h-margin], [margin, h-margin]], dtype="float32"),
        "card_type": _estimate_card_type(aspect_ratio),
        "original_size": (h, w),
    }


def _estimate_card_type(aspect_ratio: float) -> str:
    """アスペクト比からカードタイプを推定"""
    # スタンダード: 63/88 ≈ 0.716
    # スモール: 59/86 ≈ 0.686
    if abs(aspect_ratio - 0.716) < 0.05:
        return "standard"
    elif abs(aspect_ratio - 0.686) < 0.05:
        return "small"
    else:
        return "standard"  # デフォルト
