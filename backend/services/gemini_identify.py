"""Gemini Vision でカード識別 (型番 + カード名抽出)"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Optional

import httpx

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
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
