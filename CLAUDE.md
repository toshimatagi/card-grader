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
- オフライン検証: `GEMINI_API_KEY="" Gemini_API_Key=""` で AI をスキップし OpenCV 経路（決定的）になる

## デプロイ（push では自動デプロイされない）
- **フロントを先に**: リポジトリルートで `vercel deploy --prod`
- backend は Render ダッシュボードから Manual Deploy（Auto-Deploy はオフだった実績あり）
- 順序理由: `/api/v1/grade` は画像を Storage URL（失敗時 base64）で返す契約で、旧フロントは URL を扱えない

## 注意
- Gemini は `gemini-2.5-flash` を使用（2.0-flash は 429 頻発）。503 はリトライで対処
- センタリング測定は AI 2-call アプローチ（本番稼働中、`mode: gemini_ai_2call`。検証: `backend/test_ai_centering.py`）
- httpx 0.28: `client.delete()` は `json=` ボディ非対応。`client.request("DELETE", ...)` を使う
- `backend/debug_*.py` は untracked のデバッグ用。テスト画像は `images/`
- 改善タスクの一覧と着手順: `docs/improvement-tasks.md`
