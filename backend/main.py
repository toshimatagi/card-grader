"""カード鑑定士アプリ - バックエンドエントリポイント"""

import asyncio
import os

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .routers import cards, grade

app = FastAPI(
    title="Card Grader API",
    description="トレーディングカード自動鑑定API",
    version="0.1.0",
)

# CORS設定（環境変数 or デフォルト）
allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# APIルーター
app.include_router(grade.router)
app.include_router(cards.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# =============================================================================
# Cron endpoints — 外部 (GitHub Actions など) から POST で叩いて走らせる。
# Render IP からの呼び出しなので yuyutei 等 GH Actions IP がブロックされてる
# ソースのクロールに使う。
# =============================================================================

CRON_SECRET = os.environ.get("CRON_SECRET", "")


def _verify_cron_secret(x_cron_secret: str | None) -> None:
    if not CRON_SECRET:
        raise HTTPException(status_code=503, detail="CRON_SECRET not configured")
    if x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=401, detail="invalid cron secret")


async def _run_crawler_background(source: str, brand: str, scope: str) -> None:
    """BackgroundTask で実行されるクローラー本体。例外は握りつぶしてログのみ。"""
    try:
        from .crawlers.run import run
        await run(source=source, brand=brand, sets=[], dry_run=False, scope=scope)
    except Exception as e:  # noqa: BLE001
        import sys
        print(f"[cron] crawl failed: source={source} brand={brand} scope={scope}: {e}",
              file=sys.stderr)


@app.post("/cron/crawl-yuyutei-pokemon")
async def cron_crawl_yuyutei_pokemon(
    background: BackgroundTasks,
    x_cron_secret: str | None = Header(default=None),
):
    """yuyutei-pokemon を全セット (scope=all) で daily 実行。
    Render IP からなら 200 で叩けるが、GH Actions IP は 403 で弾かれるため
    GH Actions cron からこの endpoint を呼ぶ二段構え。

    BackgroundTask で非同期実行、即座に 202 を返す (Render の HTTP timeout 100s
    を超えるため、同期実行は不可)。
    """
    _verify_cron_secret(x_cron_secret)
    background.add_task(_run_crawler_background, "yuyutei", "pokemon", "all")
    return {"status": "queued", "source": "yuyutei", "brand": "pokemon", "scope": "all"}


@app.post("/cron/crawl-cardrush-pokemon")
async def cron_crawl_cardrush_pokemon(
    background: BackgroundTasks,
    x_cron_secret: str | None = Header(default=None),
):
    """cardrush-pokemon を Render IP から叩く (Cloudflare 対策)。
    cardrush scraper の pokemon 対応が入った後で意味を持つ。"""
    _verify_cron_secret(x_cron_secret)
    background.add_task(_run_crawler_background, "cardrush", "pokemon", "all")
    return {"status": "queued", "source": "cardrush", "brand": "pokemon", "scope": "all"}
