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


@app.get("/debug/pokemon-sources-probe")
async def pokemon_sources_probe():
    """Render IP からポケカ系の候補ソースを総ナメで叩いて 200/403 を判定。
    用済みになったら削除する。"""
    import httpx
    # 各候補サイトの「商品一覧 or トップ」っぽい URL
    targets = [
        # 既存運用
        ("yuyutei",           "https://yuyu-tei.jp/sell/poc/s/m04"),
        ("fullahead-pkm",     "https://pokemon-card-fullahead.com/shopbrand/m03/page1/"),
        # 候補 (販売)
        ("cardrush-pkm",      "https://www.cardrush-pokemon.jp/product-group/9"),
        ("cardrush-pkm-top",  "https://www.cardrush-pokemon.jp/"),
        ("torecard-pkm",      "https://www.torecard.com/pokemon/list/"),
        ("toreca-mania-pkm",  "https://toreca-mania.com/"),
        ("bigweb-pkm",        "https://www.bigweb.tokyo/ja/items/pokemon"),
        ("hareruya2-pkm",     "https://www.hareruya2.com/category/279"),
        ("cardshop-magi-pkm", "https://magi.camp/"),
        # 候補 (買取査定)
        ("surugaya-pkm",      "https://www.suruga-ya.jp/search?category=11203&search_word=&restrict%5B%5D=tag_kind%3A%E3%83%9D%E3%82%B1%E3%83%A2%E3%83%B3"),
        ("surugaya-top",      "https://www.suruga-ya.jp/"),
        ("kaitori-toretoku",  "https://kaitori-toretoku.jp/pokemon"),
        ("cardrush-kaitori",  "https://kaitori.cardrush.jp/"),
        # robots.txt も見ておく (合法性確認)
        ("surugaya-robots",   "https://www.suruga-ya.jp/robots.txt"),
        ("cardrush-pkm-robots","https://www.cardrush-pokemon.jp/robots.txt"),
        ("yuyutei-robots",    "https://yuyu-tei.jp/robots.txt"),
    ]
    ua = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    results = []
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        for name, url in targets:
            try:
                r = await client.get(url, headers={"User-Agent": ua})
                # robots.txt は本文も少し返す
                preview = None
                if "/robots.txt" in url and r.status_code == 200:
                    preview = r.text[:600]
                results.append({
                    "name": name,
                    "url": url,
                    "status": r.status_code,
                    "bytes": len(r.content),
                    "final_url": str(r.url),
                    "robots_preview": preview,
                })
            except Exception as e:
                results.append({"name": name, "url": url, "error": str(e)[:200]})
    return {"results": results}
