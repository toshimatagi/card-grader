"""カード鑑定士アプリ - バックエンドエントリポイント"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import grade

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


@app.get("/health")
async def health():
    return {"status": "ok"}
