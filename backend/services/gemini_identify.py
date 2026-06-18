"""Gemini Vision でカード識別 (型番 + カード名抽出)"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Optional

import httpx

GEMINI_API_KEY = (
    os.environ.get("Gemini_API_Key")
    or os.environ.get("GEMINI_API_KEY")
    or ""
)
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

_PROMPT = """この画像はトレーディングカード(主にONE PIECE カードゲーム)です。
カード左下または右下に印字されている型番(例: OP09-050, ST10-013, EB01-001, PRB02-007)と、カード名を読み取って下記JSONで返してください。

出力スキーマ:
{
  "set_code": "OP09" | "ST10" | "EB01" | "PRB02" | null,
  "card_no": "050" | "013" | null  // 3桁ゼロパディング
  "name_ja": "ナミ" | null,        // 日本語のカード名
  "rarity": "C" | "UC" | "R" | "SR" | "L" | "SEC" | "SP" | null,
  "confidence": 0.0 〜 1.0          // 読み取り自信度
}

注意:
- 型番が読めない場合は set_code / card_no を null にしてください
- カード名は最も大きく書かれているメインの名前のみ
- JSON 以外の説明文は不要です
"""


async def identify_card(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """画像を Gemini に投げて型番・名前を JSON で取得"""
    if not GEMINI_API_KEY:
        return {"error": "GEMINI_API_KEY not set"}

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": _PROMPT},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64.b64encode(image_bytes).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                f"{GEMINI_URL}?key={GEMINI_API_KEY}",
                json=payload,
            )
    except Exception as e:
        return {"error": f"network error: {e}"}

    if res.status_code != 200:
        return {"error": f"Gemini API {res.status_code}: {res.text[:300]}"}

    try:
        data = res.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        # ```json``` 等のフェンス除去 (responseMimeType=application/json なら通常不要だが念のため)
        text = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text.strip())
        parsed = json.loads(text)
    except (KeyError, IndexError, ValueError, TypeError) as e:
        return {"error": f"parse error: {e}"}

    set_code: Optional[str] = parsed.get("set_code")
    card_no: Optional[str] = parsed.get("card_no")
    if isinstance(set_code, str):
        set_code = set_code.upper().strip() or None
    else:
        set_code = None
    if isinstance(card_no, str):
        card_no = card_no.strip()
        if card_no.isdigit():
            card_no = card_no.zfill(3)
        card_no = card_no or None
    elif isinstance(card_no, int):
        card_no = str(card_no).zfill(3)
    else:
        card_no = None

    rarity = parsed.get("rarity")
    if isinstance(rarity, str):
        rarity = rarity.strip().upper() or None

    confidence = parsed.get("confidence")
    try:
        confidence = float(confidence) if confidence is not None else 0.0
    except (TypeError, ValueError):
        confidence = 0.0

    return {
        "set_code": set_code,
        "card_no": card_no,
        "name_ja": parsed.get("name_ja"),
        "rarity": rarity,
        "confidence": confidence,
    }


_CENTERING_PROMPT = """このトレーディングカード画像のセンタリング（印刷ズレ）を測定してください。

カードには「ボーダー（外枠余白）」があり、その内側に「アートフレーム（印刷枠）」があります。
- 白ボーダーのカード：白い余白とアートフレームの境界
- カラーボーダーのカード：ボーダー色のエリアとアートフレームの境界

各辺のボーダー幅を、カードの幅・高さに対するパーセンテージで測定してください。

ワンピースTCGの参考値（標準ボーダー）:
  左右: 約3.5〜4.5%, 上: 約3.0〜4.0%, 下: 約5.0〜6.5%

以下のJSON形式のみ返してください（説明文不要）:
{
  "left_pct": 左ボーダー幅 (カード幅に対する%),
  "right_pct": 右ボーダー幅 (カード幅に対する%),
  "top_pct": 上ボーダー幅 (カード高さに対する%),
  "bottom_pct": 下ボーダー幅 (カード高さに対する%),
  "confidence": 測定の確信度 (0.0〜1.0)
}
"""


def analyze_centering_ai(card_image_bytes: bytes) -> dict | None:
    """Gemini Vision でカードのセンタリング（ボーダー幅）を測定する（同期版）。

    Args:
        card_image_bytes: JPEG 形式のカード画像バイト列

    Returns:
        {"left_pct", "right_pct", "top_pct", "bottom_pct", "confidence"} or None
    """
    if not GEMINI_API_KEY:
        return None

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": _CENTERING_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": base64.b64encode(card_image_bytes).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            res = client.post(
                f"{GEMINI_URL}?key={GEMINI_API_KEY}",
                json=payload,
            )
    except Exception as e:
        print(f"[Gemini centering] network error: {e}")
        return None

    if res.status_code != 200:
        print(f"[Gemini centering] API error {res.status_code}: {res.text[:200]}")
        return None

    try:
        data = res.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        text = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text.strip())
        parsed = json.loads(text)
    except (KeyError, IndexError, ValueError, TypeError) as e:
        print(f"[Gemini centering] parse error: {e}")
        return None

    try:
        result = {
            "left_pct":   float(parsed["left_pct"]),
            "right_pct":  float(parsed["right_pct"]),
            "top_pct":    float(parsed["top_pct"]),
            "bottom_pct": float(parsed["bottom_pct"]),
            "confidence": float(parsed.get("confidence", 0.5)),
        }
        # 異常値チェック: 各辺 0.5%〜20% の範囲外は却下
        for k in ("left_pct", "right_pct", "top_pct", "bottom_pct"):
            if not (0.5 <= result[k] <= 20.0):
                print(f"[Gemini centering] out-of-range value {k}={result[k]}")
                return None
        return result
    except (KeyError, TypeError, ValueError) as e:
        print(f"[Gemini centering] value error: {e}")
        return None
