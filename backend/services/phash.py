"""DCTベースの 64bit perceptual hash。
- DBカード画像と鑑定写真のマッチに使用
- 出力は 8 byte (big-endian) で Postgres `bytea` に格納
"""

from __future__ import annotations

import cv2
import numpy as np


def compute_phash(image_bgr: np.ndarray) -> bytes:
    """BGR画像から64bit pHashを計算して8 bytesで返す。"""
    if image_bgr is None or image_bgr.size == 0:
        raise ValueError("空の画像")

    if len(image_bgr.shape) == 3:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    else:
        gray = image_bgr

    # 32x32 にリサイズ → DCT → 左上8x8
    resized = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA)
    dct = cv2.dct(resized.astype(np.float32))
    block = dct[:8, :8].flatten()

    # DC成分(0番目)を除いた中央値で2値化
    median = float(np.median(block[1:]))
    bits = block > median

    h = 0
    for i, b in enumerate(bits):
        if b:
            h |= 1 << i
    return h.to_bytes(8, byteorder="big", signed=False)


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
