"""カード鑑定士アプリ - バックエンドエントリポイント"""

import os

from fastapi import FastAPI
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


@app.get("/debug/yuyutei-probe")
async def yuyutei_probe():
    """Render IP から yuyutei が叩けるか判定用の一時 endpoint。
    用済みになったら削除する (Render IP が yuyutei pokemon クローラーに使えるかの探査用)。"""
    import httpx
    targets = [
        "https://yuyu-tei.jp/top/poc",                  # ポケカ トップ
        "https://yuyu-tei.jp/sell/poc/s/m04",           # M04 売価
        "https://yuyu-tei.jp/sell/opc/s/op15",          # OP15 (比較用)
        "https://pokemon-card-fullahead.com/shopbrand/m03/page1/",  # 正常 baseline
    ]
    ua = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    results = []
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for url in targets:
            try:
                r = await client.get(url, headers={"User-Agent": ua})
                results.append({
                    "url": url,
                    "status": r.status_code,
                    "bytes": len(r.content),
                    "final_url": str(r.url),
                })
            except Exception as e:
                results.append({"url": url, "error": str(e)[:200]})
    return {"results": results}
