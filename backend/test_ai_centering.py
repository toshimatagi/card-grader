"""
AI専用センタリング測定テスト（OpenCV不使用）
使用: python3 test_ai_centering.py <画像パス>
"""
import sys, os, json, re, base64, httpx
from dotenv import load_dotenv
load_dotenv()

IMAGE_PATH = sys.argv[1] if len(sys.argv) > 1 else "/Users/ebiharamizuki/Downloads/IMG_2853.JPG"

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]

def _find_working_model() -> str:
    for model in _MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        try:
            with httpx.Client(timeout=8.0) as c:
                r = c.post(f"{url}?key={GEMINI_API_KEY}",
                           json={"contents": [{"parts": [{"text": "hi"}]}],
                                 "generationConfig": {"temperature": 0.0}})
            if r.status_code == 200:
                print(f"[Gemini] 使用モデル: {model}")
                return model
        except Exception:
            pass
    return _MODELS[0]

GEMINI_MODEL = _find_working_model()
GEMINI_URL   = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# ----------------------------------------------------------------
# 画像読み込み（PIL使用、EXIF回転を自動適用）
# ----------------------------------------------------------------
from PIL import Image, ImageOps
import io

def load_image_bytes(path: str) -> bytes:
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)  # EXIF回転を適用
    if img.mode != "RGB":
        img = img.convert("RGB")
    # 長辺1200pxにリサイズ
    max_side = 1200
    w, h = img.size
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    print(f"画像サイズ: {img.size[0]}x{img.size[1]}px")
    return buf.getvalue()

# ----------------------------------------------------------------
# Gemini 呼び出し
# ----------------------------------------------------------------
def gemini_call(prompt: str, image_bytes: bytes, retries: int = 3) -> str | None:
    import time
    payload = {
        "contents": [{"parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/jpeg",
                             "data": base64.b64encode(image_bytes).decode()}},
        ]}],
        "generationConfig": {"temperature": 0.0},
    }
    for attempt in range(retries):
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload)
            if res.status_code == 503:
                print(f"  503 → 5秒待ってリトライ ({attempt+1}/{retries})")
                time.sleep(5)
                continue
            if res.status_code != 200:
                print(f"[Gemini] {res.status_code}: {res.text[:200]}")
                return None
            return res.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            print(f"[Gemini] error: {e}")
            return None
    return None

def gemini_json_call(prompt: str, image_bytes: bytes, retries: int = 3) -> dict | None:
    payload = {
        "contents": [{"parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/jpeg",
                             "data": base64.b64encode(image_bytes).decode()}},
        ]}],
        "generationConfig": {"temperature": 0.0},
    }
    import time
    for attempt in range(retries):
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload)
            if res.status_code == 503:
                print(f"  503 → {3}秒待ってリトライ ({attempt+1}/{retries})")
                time.sleep(3)
                continue
            if res.status_code != 200:
                print(f"[Gemini] {res.status_code}: {res.text[:200]}")
                return None
            text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
            text = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text.strip())
            return json.loads(text)
        except Exception as e:
            print(f"[Gemini] error: {e}")
            return None
    return None

# ----------------------------------------------------------------
# Call 1: 定性観察
# ----------------------------------------------------------------
OBSERVE_PROMPT = """この写真にトレーディングカードが1枚写っています。

カードのセンタリング（印刷位置のズレ）を調べます。
カードの外周には細い色帯（外枠ライン）があり、その内側が印刷エリアです。

以下を観察して、日本語で自由に記述してください（数値不要）：

1. カードの向き：写真の中でカードは正面を向いているか、傾いているか
2. 左右比較：左側の外枠ラインと右側の外枠ラインを比べて、どちらが広い？明らかな差か、わずかな差か
3. 上下比較：上側の外枠ラインと下側の外枠ラインを比べて、どちらが広い？
4. 全体印象：このカードのセンタリングはどの程度ズレていると思うか

外枠ラインが見えにくいカード（ホロカード・フルアート等）の場合もできる限り観察してください。"""

# ----------------------------------------------------------------
# Call 2: 定量測定
# ----------------------------------------------------------------
def make_measure_prompt(observation: str) -> str:
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

# ----------------------------------------------------------------
# スコア計算
# ----------------------------------------------------------------
SCORE_TABLE = [
    (55, 10.0), (60, 9.5), (65, 9.0), (67, 8.5), (70, 8.0),
    (72, 7.5),  (75, 7.0), (77, 6.5), (80, 6.0), (82, 5.5),
    (85, 5.0),  (87, 4.5), (90, 4.0), (92, 3.5), (95, 3.0),
    (97, 2.5),  (99, 2.0), (100, 1.0),
]

def calculate_score(worse_ratio_pct: float) -> float:
    for threshold, score in SCORE_TABLE:
        if worse_ratio_pct <= threshold:
            return score
    return 1.0

# ----------------------------------------------------------------
# メイン
# ----------------------------------------------------------------
print(f"\n=== AI センタリングテスト ===")
print(f"画像: {IMAGE_PATH}")

img_bytes = load_image_bytes(IMAGE_PATH)

print("\n[Call 1] 定性観察...")
observation = gemini_call(OBSERVE_PROMPT, img_bytes)
if not observation:
    print("Call 1 失敗")
    sys.exit(1)
print(f"\n観察結果:\n{observation}")

print("\n[Call 2] 定量測定...")
measure_prompt = make_measure_prompt(observation)
result = gemini_json_call(measure_prompt, img_bytes)
if not result:
    print("Call 2 失敗")
    sys.exit(1)

L = result["left_pct"]
R = result["right_pct"]
T = result["top_pct"]
B = result["bottom_pct"]
conf = result.get("confidence", 0)

lr_total = L + R or 1
tb_total = T + B or 1
lr_worse = round(max(L, R) / lr_total * 100)
tb_worse = round(max(T, B) / tb_total * 100)
score = calculate_score(max(lr_worse, tb_worse))

print(f"\n=== 結果 ===")
print(f"  左: {L:.1f}%  右: {R:.1f}%  → LR: {lr_worse}/{100-lr_worse}")
print(f"  上: {T:.1f}%  下: {B:.1f}%  → TB: {tb_worse}/{100-tb_worse}")
print(f"  スコア: {score}  (confidence: {conf})")
