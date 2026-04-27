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
from .card_brands import get_brand, get_centering_mode, get_border_ratios


# 各分析の重み
WEIGHTS = {
    "centering": 0.20,
    "surface": 0.35,
    "color_print": 0.20,
    "edges_corners": 0.25,
}


def grade_card(image_bytes: bytes, card_type: str = "standard",
               brand: str = "", rarity: str = "",
               options: dict | None = None,
               manual_centering: dict | None = None) -> dict:
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

    # 高解像度画像をリサイズして処理速度を改善（長辺1200px上限）
    image = _resize_if_needed(image, max_side=1200)

    # 1. 前処理: カード領域検出
    # 手動センタリング時はトリミングしない（エディターと同じ画像を使う）
    use_trim = not (manual_centering and "lr_ratio" in manual_centering)
    card_data = detect_card(image, trim=use_trim)
    card_image = card_data["card_image"]

    # カード画像も処理用にリサイズ（長辺800px上限）
    card_image = _resize_if_needed(card_image, max_side=800)
    card_data["card_image"] = card_image

    # ブランド情報からcard_typeを自動補完
    if brand:
        brand_info = get_brand(brand)
        if brand_info:
            card_type = brand_info.size

    # センタリングモードとボーダー比率を決定
    centering_mode = get_centering_mode(brand, rarity) if brand else "bordered"
    border_ratios = get_border_ratios(brand) if brand else None

    # 2. 各分析を実行
    if manual_centering and "lr_ratio" in manual_centering:
        centering_result = _build_manual_centering_result(manual_centering, card_image)
    else:
        centering_result = analyze_centering(card_image, mode=centering_mode, border_ratios=border_ratios)
    # color を先に走らせて is_holo を取得し、surface/edges に渡してホロ用に閾値を緩める
    color_result = analyze_color(card_image)
    is_holo = bool(color_result.get("detail", {}).get("is_holo"))
    surface_result = analyze_surface(card_image, is_holo=is_holo)

    # 手動センタリングで outer_corners が指定されていれば、edges.py に渡して
    # 実カード実角を corner region として分析させる (斜め撮影対応)
    edges_outer_corners = None
    if manual_centering and "outer_corners" in manual_centering:
        oc = manual_centering["outer_corners"]
        # フロントは元画像座標で送ってくるので、card_image にスケール
        src_w = manual_centering.get("source_width") or card_image.shape[1]
        src_h = manual_centering.get("source_height") or card_image.shape[0]
        sx = card_image.shape[1] / max(src_w, 1)
        sy = card_image.shape[0] / max(src_h, 1)
        try:
            edges_outer_corners = {
                k: [int(oc[k][0] * sx), int(oc[k][1] * sy)] for k in ("tl", "tr", "bl", "br")
            }
        except (KeyError, TypeError, IndexError):
            edges_outer_corners = None
    edges_result = analyze_edges(card_image, is_holo=is_holo, outer_corners=edges_outer_corners)

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


def _build_manual_centering_result(manual: dict, card_image: np.ndarray) -> dict:
    """
    フロントエンドの手動センタリングデータから、
    自動検出と同じフォーマットの結果を構築する。
    """
    h, w = card_image.shape[:2]

    lr_ratio = manual.get("lr_ratio", "50/50")
    tb_ratio = manual.get("tb_ratio", "50/50")
    left_border = manual.get("left_border", 0)
    right_border = manual.get("right_border", 0)
    top_border = manual.get("top_border", 0)
    bottom_border = manual.get("bottom_border", 0)

    # LR/TBの大きい方からスコアを算出
    lr_parts = lr_ratio.split("/")
    tb_parts = tb_ratio.split("/")
    lr_larger = int(lr_parts[0]) if len(lr_parts) == 2 else 50
    tb_larger = int(tb_parts[0]) if len(tb_parts) == 2 else 50
    max_deviation = max(lr_larger, tb_larger)

    # PSA基準のスコア
    if max_deviation <= 50:
        score = 10.0
    elif max_deviation <= 55:
        score = 9.5 - (max_deviation - 50) * 0.1
    elif max_deviation <= 60:
        score = 9.0 - (max_deviation - 55) * 0.2
    elif max_deviation <= 65:
        score = 8.0 - (max_deviation - 60) * 0.2
    elif max_deviation <= 70:
        score = 7.0 - (max_deviation - 65) * 0.2
    else:
        score = max(1.0, 6.0 - (max_deviation - 70) * 0.1)

    # オーバーレイ画像を生成（手動位置を反映）
    overlay = card_image.copy()

    # 4隅指定があれば四角形 (斜め対応)、なければ矩形でフォールバック
    outer_corners = manual.get("outer_corners")
    inner_corners = manual.get("inner_corners")

    def _scaled_quad(corners: dict, src_w: int, src_h: int) -> np.ndarray | None:
        if not corners:
            return None
        try:
            pts = [corners["tl"], corners["tr"], corners["br"], corners["bl"]]
            scale_x = w / max(src_w, 1)
            scale_y = h / max(src_h, 1)
            return np.array(
                [[int(p[0] * scale_x), int(p[1] * scale_y)] for p in pts],
                dtype=np.int32,
            )
        except (KeyError, TypeError, IndexError):
            return None

    src_w = manual.get("source_width") or w
    src_h = manual.get("source_height") or h
    outer_quad = _scaled_quad(outer_corners, src_w, src_h)
    inner_quad = _scaled_quad(inner_corners, src_w, src_h)

    if outer_quad is not None:
        cv2.polylines(overlay, [outer_quad], isClosed=True, color=(0, 255, 255), thickness=2)
    else:
        ox1 = max(0, left_border - int(left_border * 0.2)) if left_border > 5 else 0
        oy1 = max(0, top_border - int(top_border * 0.2)) if top_border > 5 else 0
        ox2 = min(w, w - right_border + int(right_border * 0.2)) if right_border > 5 else w
        oy2 = min(h, h - bottom_border + int(bottom_border * 0.2)) if bottom_border > 5 else h
        cv2.rectangle(overlay, (ox1, oy1), (ox2, oy2), (0, 255, 255), 2)

    if inner_quad is not None:
        cv2.polylines(overlay, [inner_quad], isClosed=True, color=(0, 255, 0), thickness=2)
    else:
        ix1 = left_border
        iy1 = top_border
        ix2 = w - right_border
        iy2 = h - bottom_border
        cv2.rectangle(overlay, (ix1, iy1), (ix2, iy2), (0, 255, 0), 2)

    # テキスト表示
    cv2.putText(overlay, f"LR: {lr_ratio} (L:{left_border} R:{right_border})",
                (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
    cv2.putText(overlay, f"TB: {tb_ratio} (T:{top_border} B:{bottom_border})",
                (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
    cv2.putText(overlay, "[Manual]", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 255), 1)

    return {
        "score": round(score, 1),
        "detail": {
            "lr_ratio": lr_ratio,
            "tb_ratio": tb_ratio,
            "left_border": left_border,
            "right_border": right_border,
            "top_border": top_border,
            "bottom_border": bottom_border,
            "mode": "manual",
        },
        "overlay": overlay,
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


def _resize_if_needed(image: np.ndarray, max_side: int = 1200) -> np.ndarray:
    """長辺がmax_sideを超える場合にリサイズ"""
    h, w = image.shape[:2]
    if max(h, w) <= max_side:
        return image
    scale = max_side / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)


def _image_to_base64(image: np.ndarray) -> str:
    """OpenCV画像をBase64文字列に変換"""
    _, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 75])
    return base64.b64encode(buffer).decode("utf-8")
