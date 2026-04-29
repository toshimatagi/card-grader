"""DCTベースの 64bit perceptual hash。
- DBカード画像と鑑定写真のマッチに使用
- 出力は 8 byte (big-endian) で Postgres `bytea` に格納
"""

from __future__ import annotations

import cv2
import numpy as np


# OPカードのアート領域（上から下方向の比率、左右余白の比率）。
# 0-58% は上部のキャラクターアート、下部の名前/コスト/効果テキスト枠を除外する。
_ART_TOP = 0.0
_ART_BOTTOM = 0.58
_ART_SIDE_MARGIN = 0.04


def compute_phash(image_bgr: np.ndarray) -> bytes:
    """画像（カードと想定）から64bit pHash（アート領域基準）を返す。
    一様画像（透明gif等）や極小画像は ValueError。
    """
    if image_bgr is None or image_bgr.size == 0:
        raise ValueError("空の画像")

    if len(image_bgr.shape) == 3:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    else:
        gray = image_bgr

    h, w = gray.shape[:2]
    if h < 80 or w < 80:
        raise ValueError(f"画像が小さすぎる: {w}x{h}")

    # 一様画像（透明gif、白塗りプレースホルダ等）リジェクト
    if float(np.std(gray)) < 5.0:
        raise ValueError("一様画像（コンテンツなし）")

    # アート領域に絞る（上半分中心）
    top = int(h * _ART_TOP)
    bottom = int(h * _ART_BOTTOM)
    side = int(w * _ART_SIDE_MARGIN)
    art = gray[top:bottom, side : w - side]
    if art.size == 0:
        art = gray  # フォールバック

    # 32x32 にリサイズ → DCT → 左上8x8
    resized = cv2.resize(art, (32, 32), interpolation=cv2.INTER_AREA)
    dct = cv2.dct(resized.astype(np.float32))
    block = dct[:8, :8].flatten()

    # DC成分(0番目)を除いた中央値で2値化
    median = float(np.median(block[1:]))
    bits = block > median

    h_int = 0
    for i, b in enumerate(bits):
        if b:
            h_int |= 1 << i
    return h_int.to_bytes(8, byteorder="big", signed=False)


def hamming_distance(a: bytes, b: bytes) -> int:
    """8byte 同士のハミング距離 (0..64)。"""
    if len(a) != 8 or len(b) != 8:
        raise ValueError("8byte 必須")
    xor = int.from_bytes(a, "big") ^ int.from_bytes(b, "big")
    return xor.bit_count()


def compute_phash_from_bytes(image_bytes: bytes) -> bytes:
    """JPEG/PNG等のbytesからpHashを計算。"""
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("画像のデコードに失敗")
    return compute_phash(img)
