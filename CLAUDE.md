# Card Grader — TCG 鑑定アプリ

カード画像からセンタリング・傷・色などを自動鑑定する Web アプリ。frontend / backend の 2 層モノレポ。

## 構成
- `frontend/` — Next.js 14 + TypeScript + Tailwind。Vercel にデプロイ
- `backend/` — FastAPI + OpenCV + Gemini API。Render にデプロイ（`backend/render.yaml`）。本番: https://card-grader-api-tkae.onrender.com
- `.github/workflows/` — 価格クローラ等の cron（crawl-*, cron-*, keepalive）
- DB: Supabase project_ref `xhjdzkpfgybcsuesasqj`（**ramen-roppou と同一プロジェクトを共有**）

## 開発
- backend: `backend/venv/bin/uvicorn backend.main:app --reload`（リポジトリルートから実行。venv は `backend/venv/`）
- frontend: `cd frontend && npm run dev` / 型チェック: `npx tsc --noEmit`

## 注意
- Gemini は `gemini-2.5-flash` を使用（2.0-flash は 429 頻発）。503 はリトライで対処
- センタリング測定は AI 2-call アプローチへ刷新中（検証: `backend/test_ai_centering.py`）
- `backend/debug_*.py` は untracked のデバッグ用。テスト画像は `images/`
