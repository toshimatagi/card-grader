"""表面傷検出モジュール"""

import cv2
import numpy as np


def analyze_surface(card_image: np.ndarray) -> dict:
    """
    カード表面の傷・ダメージを検出する。

    検出対象:
    - スクラッチ（線状の傷）
    - ホワイトニング（白化）
    - 折れ・クリース
    - 角のダメージ

    Returns:
        dict: スコアと詳細データ
    """
    h, w = card_image.shape[:2]
    gray = cv2.cvtColor(card_image, cv2.COLOR_BGR2GRAY)

    defects = []

    # 1. スクラッチ検出
    scratches = _detect_scratches(gray)
    defects.extend(scratches)

    # 2. ホワイトニング検出
    whitening = _detect_whitening(card_image, gray)
    defects.extend(whitening)

    # 3. 折れ・クリース検出
    creases = _detect_creases(gray)
    defects.extend(creases)

    # 4. 角のダメージ検出
    corner_damage = _detect_corner_damage(gray)
    defects.extend(corner_damage)

    # スコア算出
    score = _calculate_score(defects)

    # 深刻度判定
    severity = _overall_severity(defects)
    whitening_level = _whitening_level(whitening)

    # オーバーレイ画像生成
    overlay = _generate_overlay(card_image, defects)

    return {
        "score": score,
        "detail": {
            "scratches": len(scratches),
            "severity": severity,
            "whitening": whitening_level,
            "defects": [
                {
                    "type": d["type"],
                    "severity": d["severity"],
                    "location": d["location"],
                    "area": d.get("area", 0),
                }
                for d in defects
            ],
        },
        "overlay": overlay,
    }


def _detect_scratches(gray: np.ndarray) -> list:
    """線状の傷（スクラッチ）を検出"""
    h, w = gray.shape
    defects = []

    # ガウシアンブラーでノイズ除去
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # 元画像との差分で微細な構造を抽出
    diff = cv2.absdiff(gray, blurred)

    # 閾値処理
    _, thresh = cv2.threshold(diff, 15, 255, cv2.THRESH_BINARY)

    # モルフォロジー処理でノイズ除去
    kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel_open)

    # 線状構造の強調（水平・垂直・斜め方向のカーネル）
    kernels = [
        cv2.getStructuringElement(cv2.MORPH_RECT, (15, 1)),  # 水平
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, 15)),  # 垂直
    ]

    scratch_mask = np.zeros_like(gray)
    for kernel in kernels:
        detected = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel)
        scratch_mask = cv2.bitwise_or(scratch_mask, detected)

    # 輪郭抽出
    contours, _ = cv2.findContours(scratch_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 20:  # 小さすぎるものは無視
            continue

        x, y, cw, ch = cv2.boundingRect(contour)
        aspect = max(cw, ch) / max(min(cw, ch), 1)

        # 線状（アスペクト比が高い）のものをスクラッチと判定
        if aspect > 3 and area > 30:
            severity = "minor" if area < 200 else ("major" if area < 1000 else "critical")
            defects.append({
                "type": "scratch",
                "severity": severity,
                "location": _location_label(x + cw//2, y + ch//2, w, h),
                "bbox": (x, y, cw, ch),
                "area": int(area),
            })

    return defects


def _detect_whitening(color_image: np.ndarray, gray: np.ndarray) -> list:
    """エッジや角のホワイトニング（白化）を検出"""
    h, w = gray.shape
    defects = []

    # カードの端のみをチェック（ボーダー領域10%）
    margin = int(min(h, w) * 0.1)

    regions = {
        "top_edge": gray[:margin, :],
        "bottom_edge": gray[h-margin:, :],
        "left_edge": gray[:, :margin],
        "right_edge": gray[:, w-margin:],
    }

    for name, region in regions.items():
        # 明るすぎるピクセルの割合
        bright_pixels = np.sum(region > 230) / max(region.size, 1)

        if bright_pixels > 0.15:  # 15%以上が白い場合
            severity = "minor" if bright_pixels < 0.3 else "major"
            defects.append({
                "type": "whitening",
                "severity": severity,
                "location": name.replace("_", " "),
                "area": int(bright_pixels * 100),
            })

    return defects


def _detect_creases(gray: np.ndarray) -> list:
    """折れ・クリースを検出"""
    h, w = gray.shape
    defects = []

    # ラプラシアンフィルタで急激な明度変化を検出
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    abs_laplacian = np.abs(laplacian)

    # 強いエッジを閾値処理
    threshold = np.mean(abs_laplacian) + 4 * np.std(abs_laplacian)
    _, strong_edges = cv2.threshold(abs_laplacian.astype(np.uint8),
                                     int(min(threshold, 255)), 255, cv2.THRESH_BINARY)

    # 長い直線状のエッジを検出（Hough変換）
    lines = cv2.HoughLinesP(strong_edges, 1, np.pi/180, threshold=50,
                            minLineLength=int(min(h, w) * 0.15),
                            maxLineGap=10)

    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            length = np.sqrt((x2-x1)**2 + (y2-y1)**2)

            # ボーダー付近の線は無視（カード枠の検出を避ける）
            margin = int(min(h, w) * 0.12)
            mid_x = (x1 + x2) / 2
            mid_y = (y1 + y2) / 2

            if (margin < mid_x < w - margin and margin < mid_y < h - margin):
                severity = "major" if length > min(h, w) * 0.3 else "minor"
                defects.append({
                    "type": "crease",
                    "severity": severity,
                    "location": _location_label(int(mid_x), int(mid_y), w, h),
                    "bbox": (min(x1, x2), min(y1, y2),
                             abs(x2-x1), abs(y2-y1)),
                    "area": int(length * 2),
                })

    return defects


def _detect_corner_damage(gray: np.ndarray) -> list:
    """4角のダメージを検出"""
    h, w = gray.shape
    defects = []

    corner_size = int(min(h, w) * 0.1)

    corners = {
        "top-left": gray[:corner_size, :corner_size],
        "top-right": gray[:corner_size, w-corner_size:],
        "bottom-left": gray[h-corner_size:, :corner_size],
        "bottom-right": gray[h-corner_size:, w-corner_size:],
    }

    for name, region in corners.items():
        # エッジの強さを計測
        edges = cv2.Canny(region, 50, 150)
        edge_density = np.sum(edges > 0) / max(edges.size, 1)

        # 角が丸まっているか、ダメージがあると
        # エッジの分布が不規則になる
        # 正常な角: 2辺のエッジがL字型
        # ダメージ角: エッジが散在

        # テクスチャの乱れ度合い
        std_dev = np.std(region.astype(float))

        if edge_density > 0.15 and std_dev > 40:
            severity = "minor" if std_dev < 60 else "major"
            defects.append({
                "type": "corner_damage",
                "severity": severity,
                "location": name,
                "area": int(std_dev),
            })

    return defects


def _location_label(x: int, y: int, w: int, h: int) -> str:
    """座標をラベルに変換"""
    v = "top" if y < h/3 else ("center" if y < 2*h/3 else "bottom")
    hz = "left" if x < w/3 else ("center" if x < 2*w/3 else "right")
    return f"{v}-{hz}"


def _calculate_score(defects: list) -> float:
    """傷の数と深刻度からスコアを算出"""
    if not defects:
        return 10.0

    penalty = 0.0
    for d in defects:
        if d["severity"] == "critical":
            penalty += 3.0
        elif d["severity"] == "major":
            penalty += 1.5
        elif d["severity"] == "minor":
            penalty += 0.5

    score = max(1.0, 10.0 - penalty)
    return round(score * 2) / 2  # 0.5刻み


def _overall_severity(defects: list) -> str:
    """全体の深刻度"""
    if not defects:
        return "none"
    severities = [d["severity"] for d in defects]
    if "critical" in severities:
        return "critical"
    elif "major" in severities:
        return "major"
    return "minor"


def _whitening_level(whitening_defects: list) -> str:
    """ホワイトニングの総合レベル"""
    if not whitening_defects:
        return "none"
    if any(d["severity"] == "major" for d in whitening_defects):
        return "significant"
    return "slight"


def _generate_overlay(card_image: np.ndarray, defects: list) -> np.ndarray:
    """傷検出のオーバーレイ画像を生成"""
    overlay = card_image.copy()

    colors = {
        "scratch": (0, 0, 255),       # 赤
        "whitening": (0, 165, 255),    # オレンジ
        "crease": (0, 0, 200),         # 暗い赤
        "corner_damage": (255, 0, 255), # マゼンタ
    }

    for d in defects:
        color = colors.get(d["type"], (0, 0, 255))

        if "bbox" in d:
            x, y, bw, bh = d["bbox"]
            cv2.rectangle(overlay, (x, y), (x+bw, y+bh), color, 2)
            label = f"{d['type']}({d['severity']})"
            cv2.putText(overlay, label, (x, max(y-5, 15)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.35, color, 1)

    # 傷の総数を表示
    text = f"Defects: {len(defects)}"
    cv2.putText(overlay, text, (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    return overlay
