"""総合グレーディング・オーケストレーションモジュール"""

import uuid
import base64
from datetime import datetime, timezone

import cv2
import numpy as np

from .preprocessing import detect_card
from .centering import analyze_centering
from .surface import analyze_surface
from .color import analyze_color
from .edges import analyze_edges


# 各分析の重み
WEIGHTS = {
    "centering": 0.20,
    "surface": 0.35,
    "color_print": 0.20,
    "edges_corners": 0.25,
}


def grade_card(image_bytes: bytes, card_type: str = "standard",
               options: dict | None = None) -> dict:
    """
    カード画像を総合鑑定する。

    Args:
        image_bytes: 画像のバイトデータ
        card_type: カードタイプ (standard/small/custom)
        options: オプション設定

    Returns:
        dict: 鑑定結果
    """
    options = options or {"detailed_report": True, "overlay_images": True}

    # バイトデータからOpenCV画像に変換
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("画像のデコードに失敗しました")

    # 1. 前処理: カード領域検出
    card_data = detect_card(image)
    card_image = card_data["card_image"]

    # 2. 各分析を実行
    centering_result = analyze_centering(card_image)
    surface_result = analyze_surface(card_image)
    color_result = analyze_color(card_image)
    edges_result = analyze_edges(card_image)

    # 3. 総合スコア算出
    sub_scores = {
        "centering": centering_result["score"],
        "surface": surface_result["score"],
        "color_print": color_result["score"],
        "edges_corners": edges_result["score"],
    }

    overall = sum(sub_scores[k] * WEIGHTS[k] for k in WEIGHTS)
    overall_grade = _round_grade(overall)

    # 4. 信頼度算出
    confidence = _calculate_confidence(card_data, sub_scores)

    # 5. オーバーレイ画像をBase64化
    overlay_images = {}
    if options.get("overlay_images"):
        overlay_images = {
            "centering": _image_to_base64(centering_result["overlay"]),
            "surface_defects": _image_to_base64(surface_result["overlay"]),
            "color_analysis": _image_to_base64(color_result["overlay"]),
            "edges_corners": _image_to_base64(edges_result["overlay"]),
        }

    # カード画像もBase64化
    card_image_b64 = _image_to_base64(card_image)

    grade_id = str(uuid.uuid4())

    return {
        "id": grade_id,
        "overall_grade": overall_grade,
        "confidence": round(confidence, 2),
        "card_image": card_image_b64,
        "card_type": card_data["card_type"],
        "sub_grades": {
            "centering": {
                "score": centering_result["score"],
                "detail": centering_result["detail"],
            },
            "surface": {
                "score": surface_result["score"],
                "detail": surface_result["detail"],
            },
            "color_print": {
                "score": color_result["score"],
                "detail": color_result["detail"],
            },
            "edges_corners": {
                "score": edges_result["score"],
                "detail": edges_result["detail"],
            },
        },
        "overlay_images": overlay_images,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def _round_grade(score: float) -> float:
    """グレードを0.5刻みに丸める"""
    return round(score * 2) / 2


def _calculate_confidence(card_data: dict, sub_scores: dict) -> float:
    """
    分析の信頼度を算出する。

    信頼度に影響する要因:
    - カード領域の検出品質
    - 画像の解像度
    - 各分析結果のばらつき
    """
    confidence = 1.0

    # カード検出の品質
    if card_data["contour"] is None:
        confidence *= 0.7  # 輪郭が見つからなかった場合

    # 画像解像度
    card_image = card_data["card_image"]
    h, w = card_image.shape[:2]
    if h < 500 or w < 350:
        confidence *= 0.6  # 低解像度
    elif h < 800 or w < 560:
        confidence *= 0.8

    # サブスコアの極端なばらつきは信頼度を下げる
    scores = list(sub_scores.values())
    score_std = np.std(scores)
    if score_std > 3.0:
        confidence *= 0.8

    return min(max(confidence, 0.1), 1.0)


def _image_to_base64(image: np.ndarray) -> str:
    """OpenCV画像をBase64文字列に変換"""
    _, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buffer).decode("utf-8")
