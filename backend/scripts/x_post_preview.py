"""X (Twitter) 投稿コンテンツを生成して Discord に投稿予定として通知 (dry-run)。

実投稿はしない。@tcg_authority_x が新規アカウント (2週間) のため、
凍結回避目的で最初 1-2週間は Discord に内容確認のみ。
内容OKなら手動でコピペ投稿、または Phase 2 で手動承認制 API 投稿に進む。

GitHub Actions cron で毎朝 8:00 JST (UTC 23:00 前日) に実行される想定。
"""
from __future__ import annotations

import datetime
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
DISCORD_WEBHOOK_URL = os.environ["DISCORD_WEBHOOK_URL"]
SITE_URL = os.environ.get("SITE_URL", "https://tcg-authority.com")

# X Web Intent (pre-filled URL): ユーザーが Discord 通知のリンクを開くと、
# X のツイート画面が文面プレフィル状態で開く → ワンクリックで手動投稿可
X_INTENT_BASE = "https://twitter.com/intent/tweet"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def supa_rpc(fn: str, body: dict) -> list:
    """Supabase の Stored Procedure (RPC) を呼ぶ"""
    url = f"{SUPABASE_URL}/rest/v1/rpc/{fn}"
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "User-Agent": UA,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()[:200] if hasattr(e, "read") else str(e)
        print(f"[rpc err] {fn}: {e.code} {body_text}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"[rpc err] {fn}: {e}", file=sys.stderr)
        return []


def fetch_trending(brand: str, period_hours: int, price_type: str, limit: int = 3) -> list:
    """trending_cards_v3 を呼ぶ。pokemon は min_sources=1, onepiece は 2"""
    min_sources = 1 if brand == "pokemon" else 2
    return supa_rpc(
        "trending_cards_v3",
        {
            "p_brand": brand,
            "p_period_hours": period_hours,
            "p_price_type": price_type,
            "p_limit": limit,
            "p_min_sources": min_sources,
        },
    )


def post_discord(content: str, embed_title: str, embed_desc: str, embed_url: str | None = None):
    """Discord webhook にプレビューを送信"""
    embed = {
        "title": embed_title,
        "description": embed_desc,
        "color": 0x1DA1F2,  # X (旧 Twitter blue)
    }
    if embed_url:
        embed["url"] = embed_url

    payload = {
        "username": "TCG Authority — X投稿プレビュー",
        "content": content,
        "embeds": [embed],
    }
    req = urllib.request.Request(
        DISCORD_WEBHOOK_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status
    except urllib.error.HTTPError as e:
        print(f"[discord err] {e.code} {e.read().decode()[:200]}", file=sys.stderr)
        return None


def build_intent_url(text: str) -> str:
    """X 公式の Web Intent URL を生成。ユーザーがクリックすると pre-filled の
    ツイート作成画面が開く。"""
    return f"{X_INTENT_BASE}?text={urllib.parse.quote(text)}"


# ──────────────────────────────────────────────────────────────
# 曜日別コンテンツ生成
# ──────────────────────────────────────────────────────────────

def template_trending(brand: str, brand_label: str, period_hours: int, period_label: str) -> str | None:
    """値上がりランキング TOP3"""
    items = fetch_trending(brand, period_hours, "sell", limit=3)
    if not items:
        return None
    lines = [f"📈 {period_label}の{brand_label}値上がりTOP3"]
    lines.append("")
    for i, it in enumerate(items, 1):
        code = f"{it['set_code']}-{it['card_no']}"
        name = (it.get("name_ja") or "").strip()
        if len(name) > 14:
            name = name[:13] + "…"
        pct = float(it.get("pct_change", 0))
        now = int(float(it.get("now_price", 0)))
        past = int(float(it.get("past_price", 0)))
        lines.append(
            f"{i}. {name} ({code}) +{pct:.0f}% ¥{past:,}→¥{now:,}"
        )
    landing = (
        f"{SITE_URL}/trending?brand={brand}&period={period_hours}h&type=sell"
    )
    lines.append("")
    lines.append(f"詳細 → {landing}")
    if brand == "pokemon":
        lines.append("")
        lines.append("#ポケカ #ポケモンカード")
    else:
        lines.append("")
        lines.append("#ワンピカード #ONEPIECE")
    return "\n".join(lines)


def template_spread() -> str | None:
    """PSA10 倍率 TOP3 (Raw → PSA10 で価格何倍?)"""
    # spread RPC があるか不明なので、雑に trending_cards_v3 sell 168 を流用、
    # 厳密な spread は将来 RPC 追加。とりあえずダミー文面
    return None  # TODO: spread RPC 整備後に有効化


def template_collection_promo() -> str:
    """コレクション機能の紹介投稿 (日曜)"""
    text = (
        "💰 あなたのポケカ・ワンピカード資産、合計いくらか把握してます?\n"
        "\n"
        "TCG Authority のコレクション機能なら、\n"
        "・カードを登録するだけで合計評価額を自動算出\n"
        "・状態 (Raw/PSA10など) 別に管理\n"
        "・含み損益も一発表示\n"
        "\n"
        "Google ログイン1秒、無料 → https://tcg-authority.com/collection\n"
        "\n"
        "#ポケカ #ワンピカード"
    )
    return text


def template_psa10_guide() -> str:
    """PSA10 提出 損益シミュレーター誘導 (土曜)"""
    text = (
        "🎯 PSA10 提出の損益、計算したことあります?\n"
        "\n"
        "鑑定費用 ¥4,800 + 仕入価格 vs 期待売却価格 を\n"
        "AI鑑定スコアの確率分布で重み付けして即試算。\n"
        "\n"
        "「このカード提出した方がいい?」が秒で分かるツール、\n"
        "完全無料 → https://tcg-authority.com/cards\n"
        "\n"
        "#ポケカ #PSA10 #カード鑑定"
    )
    return text


# 曜日別ルーター (0=月..6=日)
def build_post(today: datetime.date) -> tuple[str, str]:
    """(twitter_text, content_type_label) を返す"""
    wd = today.weekday()
    # 月: ポケカ週間値上がり
    # 火: ワンピ週間値上がり
    # 水: ポケカ 24時間動き
    # 木: ワンピ 24時間動き
    # 金: ポケカ週間値上がり (再掲、別カード期待)
    # 土: PSA10ガイド誘導
    # 日: コレクション機能誘導
    if wd == 0:
        text = template_trending("pokemon", "ポケカ", 168, "先週")
        return (text or template_collection_promo(), "Mon: ポケカ週間TOP3")
    if wd == 1:
        text = template_trending("onepiece", "ワンピカード", 168, "先週")
        return (text or template_collection_promo(), "Tue: ワンピ週間TOP3")
    if wd == 2:
        text = template_trending("pokemon", "ポケカ", 24, "昨日")
        return (text or template_psa10_guide(), "Wed: ポケカ24h TOP3")
    if wd == 3:
        text = template_trending("onepiece", "ワンピカード", 24, "昨日")
        return (text or template_psa10_guide(), "Thu: ワンピ24h TOP3")
    if wd == 4:
        text = template_trending("pokemon", "ポケカ", 168, "今週")
        return (text or template_collection_promo(), "Fri: ポケカ週間TOP3 (週末向け)")
    if wd == 5:
        return (template_psa10_guide(), "Sat: PSA10ガイド誘導")
    # wd == 6
    return (template_collection_promo(), "Sun: コレクション誘導")


def main():
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date()  # JST
    tweet_text, label = build_post(today)

    char_count = len(tweet_text)
    intent_url = build_intent_url(tweet_text)

    content = (
        f"📅 **{today} ({label})**\n"
        f"文字数: **{char_count}**/280  "
        f"\n\n"
        f"**📝 投稿文 (このまま投稿可):**\n```\n{tweet_text}\n```\n"
        f"🐦 **ワンクリック投稿** (X の作成画面が prefill 状態で開く): {intent_url}\n"
    )

    embed_title = f"X投稿プレビュー — {today.isoformat()}"
    embed_desc = f"内容: {label}\n@tcg_authority_x 想定。Phase 1: 自動投稿せず Discord 確認のみ。"
    status = post_discord(content, embed_title, embed_desc, embed_url=SITE_URL)
    print(f"discord status: {status}", file=sys.stderr)
    print(f"--- tweet ({char_count} chars) ---")
    print(tweet_text)


if __name__ == "__main__":
    main()
