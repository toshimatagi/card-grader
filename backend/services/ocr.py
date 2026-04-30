"""カード画像から型番（例 'OP15-007', 'EB03-053', 'ST15-013', 'PRB02-001'）を抽出する。

ONE PIECE カードの型番は左下端に小さく印字される（白カード/有色カードどちらでも明 vs 暗で判別可能）。
1) 下部 ~12% を切り出し
2) アップスケール + 二値化（明地/暗地の両方を試す）
3) Tesseract で英数字・ハイフンのみ許可で読む
4) 正規表現で型番パターンを抽出
"""

from __future__ import annotations

import re
from typing import Optional

import cv2
import numpy as np

try:
    import pytesseract
except ImportError:  # pragma: no cover
    pytesseract = None  # type: ignore

# OP系: OP01-001, EB04-053, ST15-001, PRB02-005, P-067 (P series 例外形式)
_RE_CARD = re.compile(r"\b([A-Z]{1,4}\d{1,3})-(\d{2,4})\b")


def _preprocess_for_ocr(strip_bgr: np.ndarray, invert: bool) -> np.ndarray:
    gray = cv2.cvtColor(strip_bgr, cv2.COLOR_BGR2GRAY)
    # OCRには文字高さ ~25px 以上欲しい。元の strip 高さに応じてアップスケール。
    target_h = 80
    h = gray.shape[0]
    if h < target_h:
        scale = target_h / h
        gray = cv2.resize(
            gray,
            (int(gray.shape[1] * scale), target_h),
            interpolation=cv2.INTER_CUBIC,
        )
    # 軽くシャープ
    gray = cv2.GaussianBlur(gray, (0, 0), 1.0)
    sharp = cv2.addWeighted(gray, 1.6, gray, -0.6, 0)
    # Otsu 二値化
    _, binary = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if invert:
        binary = cv2.bitwise_not(binary)
    return binary


def _ocr_tesseract(img: np.ndarray) -> str:
    if pytesseract is None:
        return ""
    try:
        return pytesseract.image_to_string(
            img,
            config=(
                "--oem 1 --psm 7 "
                "-c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"
            ),
        )
    except Exception:
        return ""


def _candidate_strips(card_bgr: np.ndarray) -> list[np.ndarray]:
    """型番が乗っていそうな帯を複数候補で返す。"""
    h, w = card_bgr.shape[:2]
    crops = []
    # 下部 12% 全幅
    crops.append(card_bgr[int(h * 0.88) : h, :])
    # 下部 8% 全幅（より狭く）
    crops.append(card_bgr[int(h * 0.92) : h, :])
    # 下部 12% 左半分
    crops.append(card_bgr[int(h * 0.88) : h, : int(w * 0.55)])
    return crops


def _normalize_match(prefix: str, number: str) -> Optional[tuple[str, str]]:
    """OCR が `EBO3-O53` のように O/0 を間違えても拾えるよう正規化。"""
    p = prefix.upper().replace("O", "0")
    # prefix は数字以外で始まり数字で終わるべき
    m = re.match(r"^([A-Z]+)(\d{1,3})$", p)
    if not m:
        # P-067 のように prefix が 'P' のみで数字なし
        if re.fullmatch(r"[A-Z]+", p):
            set_code = p
        else:
            return None
    else:
        set_code = m.group(1) + m.group(2).lstrip("0").zfill(2)
        # OP1 → OP01, OP15 → OP15
        if not re.fullmatch(r"[A-Z]+\d{2,3}", set_code):
            return None
    n = number.replace("O", "0")
    if not re.fullmatch(r"\d+", n):
        return None
    card_no = n.zfill(3)
    return set_code, card_no


def extract_card_code(card_bgr: np.ndarray) -> Optional[str]:
    """カード画像から '<set_code>-<card_no>' を返す。読み取れなければ None。"""
    if pytesseract is None:
        return None
    if card_bgr is None or card_bgr.size == 0:
        return None

    for strip in _candidate_strips(card_bgr):
        if strip.size == 0:
            continue
        for invert in (False, True):
            pre = _preprocess_for_ocr(strip, invert=invert)
            text = _ocr_tesseract(pre).upper()
            for m in _RE_CARD.finditer(text):
                norm = _normalize_match(m.group(1), m.group(2))
                if norm:
                    return f"{norm[0]}-{norm[1]}"
    return None
