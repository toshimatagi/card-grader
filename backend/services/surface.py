"""表面傷検出モジュール"""

import cv2
import numpy as np


def analyze_surface(card_image: np.ndarray, is_holo: bool = False) -> dict:
    """
    カード表面の傷・ダメージを検出する。

    Args:
        card_image: BGR形式のカード画像
        is_holo: ホロカードかどうか (True なら検出閾値を緩める)

    Returns:
        dict: スコアと詳細データ
    """
    h, w = card_image.shape[:2]
    gray = cv2.cvtColor(card_image, cv2.COLOR_BGR2GRAY)

    # ホロカードはパターンノイズが多いので閾値を緩める
    sens = 1.5 if is_holo else 1.0

    scratches = _detect_scratches(gray, sens)
    whitening = _detect_whitening(card_image, gray, sens)
    creases = _detect_creases(gray, sens)
    corner_damage = _detect_corner_damage(gray, sens)
    defects = scratches + whitening + creases + corner_damage

    score = _calculate_score(defects)
    severity = _overall_severity(defects)
    whitening_level = _whitening_level(whitening)
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


def _detect_scratches(gray: np.ndarray, sens: float = 1.0) -> list:
    """線状の傷（スクラッチ）を検出。sens > 1 で許容を緩める。"""
    h, w = gray.shape
    defects = []

    # ガウシアンブラーでノイズ除去
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    diff = cv2.absdiff(gray, blurred)

    # 閾値処理 (sens で緩めると印刷パターンを拾わない)
    diff_thresh = int(28 * sens)
    _, thresh = cv2.threshold(diff, diff_thresh, 255, cv2.THRESH_BINARY)

    kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel_open)

    kernels = [
        cv2.getStructuringElement(cv2.MORPH_RECT, (15, 1)),
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, 15)),
    ]
    scratch_mask = np.zeros_like(gray)
    for kernel in kernels:
        detected = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel)
        scratch_mask = cv2.bitwise_or(scratch_mask, detected)

    contours, _ = cv2.findContours(scratch_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = int(60 * sens)        # 元: 20 → 大幅に緩和
    main_min_area = int(120 * sens)  # 元: 30
    minor_thresh = int(400 * sens)   # 元: 200
    major_thresh = int(1500 * sens)  # 元: 1000 (critical 境界)

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue

        x, y, cw, ch = cv2.boundingRect(contour)
        aspect = max(cw, ch) / max(min(cw, ch), 1)

        # 線状: アスペクト比 4 以上 + 一定面積 (元: 3, 30)
        if aspect > 4 and area > main_min_area:
            severity = "minor" if area < minor_thresh else ("major" if area < major_thresh else "critical")
            defects.append({
                "type": "scratch",
                "severity": severity,
                "location": _location_label(x + cw//2, y + ch//2, w, h),
                "bbox": (x, y, cw, ch),
                "area": int(area),
            })

    return defects


def _detect_whitening(color_image: np.ndarray, gray: np.ndarray, sens: float = 1.0) -> list:
    """エッジや角のホワイトニング（白化）を検出"""
    h, w = gray.shape
    defects = []

    # カードのごく端のみ (元: 10% → 6%)
    margin = int(min(h, w) * 0.06)

    regions = {
        "top_edge": gray[:margin, :],
        "bottom_edge": gray[h-margin:, :],
        "left_edge": gray[:, :margin],
        "right_edge": gray[:, w-margin:],
    }

    bright_thresh = 240          # 元: 230
    minor_ratio = 0.25 * sens    # 元: 0.15
    major_ratio = 0.45 * sens    # 元: 0.30

    for name, region in regions.items():
        bright_pixels = np.sum(region > bright_thresh) / max(region.size, 1)
        if bright_pixels > minor_ratio:
            severity = "minor" if bright_pixels < major_ratio else "major"
            defects.append({
                "type": "whitening",
                "severity": severity,
                "location": name.replace("_", " "),
                "area": int(bright_pixels * 100),
            })

    return defects


def _detect_creases(gray: np.ndarray, sens: float = 1.0) -> list:
    """折れ・クリースを検出"""
    h, w = gray.shape
    defects = []

    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    abs_laplacian = np.abs(laplacian)

    # mean + 4σ → mean + 6σ (印刷パターンを拾いにくく)
    threshold = np.mean(abs_laplacian) + 6 * sens * np.std(abs_laplacian)
    _, strong_edges = cv2.threshold(
        abs_laplacian.astype(np.uint8), int(min(threshold, 255)), 255, cv2.THRESH_BINARY
    )

    # minLineLength を 15% → 25% (短い線をクリースと誤認しない)
    lines = cv2.HoughLinesP(
        strong_edges, 1, np.pi/180, threshold=80,
        minLineLength=int(min(h, w) * 0.25),
        maxLineGap=10,
    )

    if lines is not None:
        # 中央エリア除外マージンを 12% → 18%
        margin = int(min(h, w) * 0.18)
        for line in lines:
            x1, y1, x2, y2 = line[0]
            length = np.sqrt((x2-x1)**2 + (y2-y1)**2)
            mid_x = (x1 + x2) / 2
            mid_y = (y1 + y2) / 2
            if margin < mid_x < w - margin and margin < mid_y < h - margin:
                severity = "major" if length > min(h, w) * 0.4 else "minor"
                defects.append({
                    "type": "crease",
                    "severity": severity,
                    "location": _location_label(int(mid_x), int(mid_y), w, h),
                    "bbox": (min(x1, x2), min(y1, y2), abs(x2-x1), abs(y2-y1)),
                    "area": int(length * 2),
                })

    return defects


def _detect_corner_damage(gray: np.ndarray, sens: float = 1.0) -> list:
    """4角のダメージを検出 (surface側、edges.py の corner damage と二重評価になっているので緩めに)"""
    h, w = gray.shape
    defects = []

    corner_size = int(min(h, w) * 0.1)

    corners = {
        "top-left": gray[:corner_size, :corner_size],
        "top-right": gray[:corner_size, w-corner_size:],
        "bottom-left": gray[h-corner_size:, :corner_size],
        "bottom-right": gray[h-corner_size:, w-corner_size:],
    }

    edge_thresh = 0.25 * sens   # 元: 0.15
    std_thresh = 60 * sens      # 元: 40
    major_std = 85 * sens       # 元: 60

    for name, region in corners.items():
        edges = cv2.Canny(region, 50, 150)
        edge_density = np.sum(edges > 0) / max(edges.size, 1)
        std_dev = np.std(region.astype(float))

        if edge_density > edge_thresh and std_dev > std_thresh:
            severity = "minor" if std_dev < major_std else "major"
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
    """傷の数と深刻度からスコアを算出 (再キャリブレーション後)"""
    if not defects:
        return 10.0

    # 元: critical=3.0 / major=1.5 / minor=0.5 → 多発時に floor=1 に張り付くので大幅減衰
    weights = {"critical": 1.2, "major": 0.6, "minor": 0.2}
    counts = {"critical": 0, "major": 0, "minor": 0}
    for d in defects:
        sev = d.get("severity", "minor")
        if sev in counts:
            counts[sev] += 1

    # 各深刻度ごとに先頭の n 個までは満額、それ以降は逓減 (印刷パターン誤検出のスタックを防ぐ)
    def diminishing(n: int, w: float, full: int) -> float:
        if n <= full:
            return n * w
        return full * w + (n - full) * w * 0.3

    penalty = (
        diminishing(counts["critical"], weights["critical"], full=2)
        + diminishing(counts["major"], weights["major"], full=3)
        + diminishing(counts["minor"], weights["minor"], full=5)
    )
    score = max(1.0, 10.0 - penalty)
    return round(score * 2) / 2


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
