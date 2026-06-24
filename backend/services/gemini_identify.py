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


_COMBINED_PROMPT = """このトレーディングカード（主にONE PIECE カードゲーム）の画像から、
カード識別情報とセンタリング（印刷ズレ）を1回で測定してください。

【カード識別】
カード左下または右下に印字されている型番（例: OP09-050, ST10-013, EB01-001, PRB02-007）と
カード名・レアリティを読み取ってください。

【センタリング測定】
カードの「ボーダー（外枠余白）」と「アートフレーム（印刷枠）」の境界を測定し、
各辺のボーダー幅をカードの幅・高さに対するパーセンテージで示してください。

ワンピースTCGの参考値（標準ボーダー）:
  左右: 約3.5〜4.5%, 上: 約3.0〜4.0%, 下: 約5.0〜6.5%

以下のJSON形式のみ返してください（説明文不要）:
{
  "set_code": "OP09" | "ST10" | "EB01" | null,
  "card_no": "050" | "013" | null,
  "name_ja": "ナミ" | null,
  "rarity": "C" | "UC" | "R" | "SR" | "L" | "SEC" | "SP" | null,
  "card_confidence": 0.0〜1.0,
  "left_pct": 左ボーダー幅 (カード幅に対する%),
  "right_pct": 右ボーダー幅 (カード幅に対する%),
  "top_pct": 上ボーダー幅 (カード高さに対する%),
  "bottom_pct": 下ボーダー幅 (カード高さに対する%),
  "centering_confidence": 測定の確信度 (0.0〜1.0)
}
"""


def analyze_card_and_centering_ai(card_image_bytes: bytes) -> dict | None:
    """Gemini Vision でカード識別とセンタリングを1回のリクエストで取得（同期版）。

    Returns:
        {"identification": {set_code, card_no, name_ja, rarity, confidence},
         "centering": {left_pct, right_pct, top_pct, bottom_pct, confidence}} or None
    """
    if not GEMINI_API_KEY:
        return None

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": _COMBINED_PROMPT},
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
            res = client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload)
    except Exception as e:
        print(f"[Gemini combined] network error: {e}")
        return None

    if res.status_code != 200:
        print(f"[Gemini combined] API error {res.status_code}: {res.text[:200]}")
        return None

    try:
        data = res.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        text = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text.strip())
        parsed = json.loads(text)
    except (KeyError, IndexError, ValueError, TypeError) as e:
        print(f"[Gemini combined] parse error: {e}")
        return None

    # カード識別パース
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

    card_conf = parsed.get("card_confidence")
    try:
        card_conf = float(card_conf) if card_conf is not None else 0.0
    except (TypeError, ValueError):
        card_conf = 0.0

    identification = {
        "set_code": set_code,
        "card_no": card_no,
        "name_ja": parsed.get("name_ja"),
        "rarity": rarity,
        "confidence": card_conf,
    }

    # センタリングパース
    centering = None
    try:
        c = {
            "left_pct":   float(parsed["left_pct"]),
            "right_pct":  float(parsed["right_pct"]),
            "top_pct":    float(parsed["top_pct"]),
            "bottom_pct": float(parsed["bottom_pct"]),
            "confidence": float(parsed.get("centering_confidence", 0.5)),
        }
        for k in ("left_pct", "right_pct", "top_pct", "bottom_pct"):
            if not (0.5 <= c[k] <= 20.0):
                print(f"[Gemini combined] out-of-range centering {k}={c[k]}")
                c = None
                break
        centering = c
    except (KeyError, TypeError, ValueError) as e:
        print(f"[Gemini combined] centering parse error: {e}")

    return {"identification": identification, "centering": centering}


_CENTERING_PROMPT = """このトレーディングカード画像のセンタリング（印刷ズレ）を測定してください。

カードには「ボーダー（外枠余白）」があり、その内側に「アートフレーム（印刷枠）」があります。
- 白ボーダーのカード：白い余白とアートフレームの境界
- カラーボーダーのカード：ボーダー色のエリアとアートフレームの境界

各辺のボーダー幅を、カードの幅・高さに対するパーセンテージで測定してください。

以下のJSON形式のみ返してください（説明文不要）:
{
  "left_pct": 左ボーダー幅 (カード幅に対する%),
  "right_pct": 右ボーダー幅 (カード幅に対する%),
  "top_pct": 上ボーダー幅 (カード高さに対する%),
  "bottom_pct": 下ボーダー幅 (カード高さに対する%),
  "confidence": 測定の確信度 (0.0〜1.0)
}
"""

_CENTERING_BBOX_PROMPT_BASE = """この画像は【カードのみ】を切り出した画像です。背景は一切ありません。

【座標系 — 最重要】
- 画像の左上角 = (x=0, y=0) = カードの物理的な左上角
- 画像の右下角 = (x=1000, y=1000) = カードの物理的な右下角
- 画像の端 = カードの物理的な端（背景ではない）

【測定対象】
カードの最外周には薄い「ボーダー（外枠）」があり、その内側に「プリントエリア」があります。
- ボーダー: カード端から数mm程度の細いライン。白・黒・金・銀・水色など色は様々。
- プリントエリア: ボーダーの内側の全領域（イラスト＋テキスト＋カード名＋セット番号など全て）

「プリントエリアの外縁」= ボーダーとプリントエリアの境界線 をバウンディングボックスで返してください。

JSONのみ（説明文・コメント不要）:
{
  "art_frame": {
    "y_min": <プリントエリア上端 0-1000の整数>,
    "x_min": <プリントエリア左端 0-1000の整数>,
    "y_max": <プリントエリア下端 0-1000の整数>,
    "x_max": <プリントエリア右端 0-1000の整数>
  },
  "confidence": <確信度 0.0-1.0>
}

注意事項:
- 左右ボーダーは通常ほぼ同じ幅だが、印刷ズレで異なる場合もある。実際に見えるボーダー幅を測定すること
- 上ボーダーは薄く、下ボーダーはやや広いことが多い（カード種類による）
- テキストボックス・カード名・アウトライン装飾はプリントエリア内部（内枠の内側）に含まれる
"""

_CENTERING_BBOX_PROMPT_ONEPIECE = _CENTERING_BBOX_PROMPT_BASE + """
【このカードはワンピースTCGです】
- 外枠ボーダーは薄い色付きライン（水色・シアン・黒・金など）、幅はカードの2〜5%程度
- ボーダーの内側に直接アート・テキストエリアが始まります
- キャラクター名、セット番号、COSTやPOWER表示はすべてプリントエリア（内側）に含まれます
- ボーダーと間違いやすいもの: カード内のアウトライン装飾・テキストボックスの枠線はプリントエリア内部なので除外してください
"""

_CENTERING_BBOX_PROMPT_POKEMON = _CENTERING_BBOX_PROMPT_BASE + """
【このカードはポケモンカードゲームです】
- 外枠ボーダーは白い余白、幅はカードの3〜6%程度
- ボーダーの内側にイラストエリア＋テキストエリア（HP・技・弱点など）が続きます
- カード名・HPはプリントエリア内部に含まれます
"""

_CENTERING_BBOX_PROMPT = _CENTERING_BBOX_PROMPT_BASE


def analyze_centering_ai_bbox(card_image_bytes: bytes, brand: str = "") -> dict | None:
    """Gemini Vision でアートフレームのバウンディングボックスを取得しセンタリングを測定（同期版）。

    パーセンテージ推定より空間座標検出のほうが精度が高い。

    Args:
        card_image_bytes: JPEG形式のカード画像（背景なし・カードのみ）
        brand: カードブランド ("onepiece", "pokemon" など)

    Returns:
        {"left_pct", "right_pct", "top_pct", "bottom_pct", "confidence"} or None
    """
    if not GEMINI_API_KEY:
        return None

    # ブランドに応じたプロンプトを選択
    if brand == "onepiece":
        prompt = _CENTERING_BBOX_PROMPT_ONEPIECE
    elif brand == "pokemon":
        prompt = _CENTERING_BBOX_PROMPT_POKEMON
    else:
        prompt = _CENTERING_BBOX_PROMPT_BASE

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
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
            "temperature": 0.0,
            "responseMimeType": "application/json",
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            res = client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload)
    except Exception as e:
        print(f"[Gemini bbox] network error: {e}")
        return None

    if res.status_code != 200:
        print(f"[Gemini bbox] API error {res.status_code}: {res.text[:200]}")
        return None

    try:
        data = res.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        text = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text.strip())
        parsed = json.loads(text)
    except (KeyError, IndexError, ValueError, TypeError) as e:
        print(f"[Gemini bbox] parse error: {e}")
        return None

    try:
        frame = parsed["art_frame"]
        y_min = float(frame["y_min"])
        x_min = float(frame["x_min"])
        y_max = float(frame["y_max"])
        x_max = float(frame["x_max"])

        # 1. 座標の基本検証
        if not (x_min < x_max and y_min < y_max):
            print(f"[Gemini bbox] invalid bbox: {frame}")
            return None

        # 2. アートフレームはカード全体の72%以上を占めるはず
        # 86%は厳しすぎ: 強いセンタリングズレでは片側が14%に達し合計28%になる場合もある
        if (x_max - x_min) < 720 or (y_max - y_min) < 720:
            print(f"[Gemini bbox] art_frame too small (w={x_max-x_min:.0f} h={y_max-y_min:.0f}): {frame}")
            return None

        # 3. 各ボーダーが0.1%〜14%の範囲内か検証
        # 上限14%: 強いセンタリングズレでは片側ボーダーが広くなるため広めに設定
        # 下限0.1%: ほぼゼロのボーダーは検出不能としてはじく
        left_pct   = x_min / 10
        right_pct  = (1000 - x_max) / 10
        top_pct    = y_min / 10
        bottom_pct = (1000 - y_max) / 10

        for k, v in [("left", left_pct), ("right", right_pct),
                     ("top", top_pct), ("bottom", bottom_pct)]:
            if not (0.1 <= v <= 14.0):
                print(f"[Gemini bbox] out-of-range border {k}={v:.1f}%")
                return None

        confidence = float(parsed.get("confidence", 0.5))
        print(f"[Gemini bbox] OK: L={left_pct:.1f}% R={right_pct:.1f}% T={top_pct:.1f}% B={bottom_pct:.1f}% conf={confidence:.2f}")
        return {
            "left_pct":   round(left_pct, 2),
            "right_pct":  round(right_pct, 2),
            "top_pct":    round(top_pct, 2),
            "bottom_pct": round(bottom_pct, 2),
            "confidence": confidence,
        }
    except (KeyError, TypeError, ValueError) as e:
        print(f"[Gemini bbox] value error: {e}")
        return None


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


# ---------------------------------------------------------------------------
# 2-call センタリング測定（観察 → 定量化チェーン）
# ---------------------------------------------------------------------------

_CENTERING_OBSERVE_PROMPT = """この写真にトレーディングカードが1枚写っています。

カードのセンタリング（印刷位置のズレ）を調べます。
カードの外周には細い色帯（外枠ライン）があり、その内側が印刷エリアです。

以下を観察して、日本語で自由に記述してください（数値不要）：

1. カードの向き：写真の中でカードは正面を向いているか、傾いているか
2. 左右比較：左側の外枠ラインと右側の外枠ラインを比べて、どちらが広い？明らかな差か、わずかな差か
3. 上下比較：上側の外枠ラインと下側の外枠ラインを比べて、どちらが広い？
4. 全体印象：このカードのセンタリングはどの程度ズレていると思うか

外枠ラインが見えにくいカード（ホロカード・フルアート等）の場合もできる限り観察してください。"""


def _make_centering_measure_prompt(observation: str) -> str:
    return f"""この写真のトレーディングカードについて、以下の観察結果があります：

---
{observation}
---

この観察をもとに、カードの各辺のボーダー幅を数値で測定してください。

【測定定義】
- left_pct  : 左ボーダー幅 ÷ カード全体の幅 × 100
- right_pct : 右ボーダー幅 ÷ カード全体の幅 × 100
- top_pct   : 上ボーダー幅 ÷ カード全体の高さ × 100
- bottom_pct: 下ボーダー幅 ÷ カード全体の高さ × 100

【重要】
- 対称（左右均等）とは仮定しないこと
- 観察で「左が広い」と判断した場合、left_pct > right_pct になるはず
- ワンピースTCG標準：左右各3-4%、上3%、下5%程度。ただし実際の値を優先すること

JSONのみ返してください：
{{
  "left_pct": number,
  "right_pct": number,
  "top_pct": number,
  "bottom_pct": number,
  "confidence": 0.0-1.0
}}"""


def analyze_centering_ai_2call(card_image_bytes: bytes) -> dict | None:
    """2-callチェーンでセンタリングを測定。

    Call 1: 定性観察（どちらの辺が広いか）
    Call 2: 定量測定（観察をコンテキストとして%数値化）

    単一Callで発生する50/50対称出力を防ぐため、先に定性観察させてから定量化する。
    """
    import time

    if not GEMINI_API_KEY:
        return None

    img_b64 = base64.b64encode(card_image_bytes).decode("ascii")
    _models = [GEMINI_MODEL, "gemini-2.5-flash-lite", "gemini-2.0-flash"]
    seen: set[str] = set()
    models = [m for m in _models if not (m in seen or seen.add(m))]  # type: ignore[func-returns-value]

    def _call(prompt: str, want_json: bool) -> str | dict | None:
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            for attempt in range(3):
                try:
                    payload: dict = {
                        "contents": [{"parts": [
                            {"text": prompt},
                            {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}},
                        ]}],
                        "generationConfig": {"temperature": 0.0},
                    }
                    with httpx.Client(timeout=30.0) as client:
                        res = client.post(f"{url}?key={GEMINI_API_KEY}", json=payload)
                    if res.status_code == 503:
                        print(f"[Gemini 2call] {model} 503, retry {attempt+1}/3")
                        time.sleep(3)
                        continue
                    if res.status_code != 200:
                        print(f"[Gemini 2call] {model} error {res.status_code}")
                        break
                    text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                    if not want_json:
                        return text
                    text = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text.strip())
                    return json.loads(text)
                except Exception as e:
                    print(f"[Gemini 2call] {model} exception: {e}")
                    break
        return None

    # Call 1: 定性観察
    observation = _call(_CENTERING_OBSERVE_PROMPT, want_json=False)
    if not observation:
        print("[Gemini 2call] Call 1 failed")
        return None
    print(f"[Gemini 2call] Call 1 OK: {str(observation)[:80]}...")

    # Call 2: 定量測定
    result = _call(_make_centering_measure_prompt(str(observation)), want_json=True)
    if not result or not isinstance(result, dict):
        print("[Gemini 2call] Call 2 failed")
        return None

    try:
        L = float(result["left_pct"])
        R = float(result["right_pct"])
        T = float(result["top_pct"])
        B = float(result["bottom_pct"])
        conf = float(result.get("confidence", 0.7))

        for name, val in [("left", L), ("right", R), ("top", T), ("bottom", B)]:
            if not (0.1 <= val <= 15.0):
                print(f"[Gemini 2call] out-of-range {name}={val:.1f}%")
                return None

        print(f"[Gemini 2call] OK: L={L:.1f}% R={R:.1f}% T={T:.1f}% B={B:.1f}% conf={conf:.2f}")
        return {
            "left_pct":   round(L, 2),
            "right_pct":  round(R, 2),
            "top_pct":    round(T, 2),
            "bottom_pct": round(B, 2),
            "confidence": conf,
        }
    except (KeyError, TypeError, ValueError) as e:
        print(f"[Gemini 2call] value error: {e}")
        return None
