"""画像アップロード共通バリデーション (F-3)

Content-Type ヘッダだけでなく実ファイルのマジックバイトを検証し、
許容形式・サイズ・縦横ピクセル上限まで一括チェックする。
EXIF 含むメタデータは imdecode→imencode で副作用的に剥がれる。
"""

from __future__ import annotations

import cv2
import numpy as np
from fastapi import HTTPException


# 許容形式 (MIME → magic bytes プリフィクス)
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}

MAX_BYTES = 20 * 1024 * 1024        # 20MB
MAX_DIM = 8000                       # 縦横ピクセル上限
MIN_DIM = 200                        # 最小ピクセル (極小画像拒否)


def _check_magic(image_bytes: bytes) -> str | None:
    """マジックバイトから推定 MIME を返す。判別不能なら None。"""
    if len(image_bytes) < 12:
        return None
    head = image_bytes[:12]
    # JPEG: FF D8 FF
    if head[0:3] == b"\xFF\xD8\xFF":
        return "image/jpeg"
    # PNG: 89 50 4E 47 0D 0A 1A 0A
    if head[0:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    # WebP: RIFF....WEBP
    if head[0:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_image_bytes(image_bytes: bytes,
                         declared_mime: str | None = None,
                         label: str = "画像") -> np.ndarray:
    """
    画像バイト列を検証し、デコード済み ndarray を返す。
    失敗時は HTTPException(400) を送出する。

    - サイズ/空チェック
    - 宣言 MIME が許容内か
    - magic bytes が許容内かつ宣言と整合
    - 実際にデコードできるか
    - 縦横ピクセルが許容範囲内か (MIN_DIM <= side <= MAX_DIM)
    """
    if not image_bytes:
        raise HTTPException(400, f"{label}データが空です")
    if len(image_bytes) > MAX_BYTES:
        raise HTTPException(400, f"{label}サイズは{MAX_BYTES // (1024 * 1024)}MB以下にしてください")

    if declared_mime and declared_mime not in ALLOWED_MIME:
        raise HTTPException(400, f"{label}の対応形式: JPEG, PNG, WebP")

    sniffed = _check_magic(image_bytes)
    if sniffed is None:
        raise HTTPException(400, f"{label}: 不正なファイル形式です (JPEG/PNG/WebP のみ対応)")
    # 宣言 MIME が指定されていれば実体と一致するか確認
    if declared_mime and declared_mime != sniffed:
        raise HTTPException(
            400,
            f"{label}: ファイル形式が宣言と一致しません ({declared_mime} → 実体: {sniffed})",
        )

    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, f"{label}のデコードに失敗しました")

    h, w = image.shape[:2]
    if h < MIN_DIM or w < MIN_DIM:
        raise HTTPException(
            400,
            f"{label}が小さすぎます (最小 {MIN_DIM}x{MIN_DIM}px、現在 {w}x{h}px)",
        )
    if h > MAX_DIM or w > MAX_DIM:
        raise HTTPException(
            400,
            f"{label}が大きすぎます (最大 {MAX_DIM}x{MAX_DIM}px、現在 {w}x{h}px)",
        )

    return image
