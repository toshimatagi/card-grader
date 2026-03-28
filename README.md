# Card Grader - TCG鑑定士アプリ

トレーディングカードの画像から状態を自動鑑定するWebアプリケーション。

## 機能

- **センタリング分析**: ボーダー幅を計測し、PSA基準で左右・上下の対称性をスコアリング
- **表面傷検出**: スクラッチ、ホワイトニング、折れ、角ダメージを検出・分類
- **色・印刷分析**: 色褪せ、インクむら、彩度、ホロ/フォイル判定
- **エッジ・角分析**: 辺の直線性、角の丸み均一性、ダメージ検出
- **PSA風グレーディング**: 1-10スケールの総合スコア（0.5刻み）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 14 + TypeScript + Tailwind CSS |
| バックエンド | Python + FastAPI |
| 画像処理 | OpenCV + NumPy + scikit-image |

## セットアップ

### バックエンド

```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

API: http://localhost:8000
Docs: http://localhost:8000/docs

### フロントエンド

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:3000

## API

| メソッド | パス | 説明 |
|---------|------|------|
| POST | /api/v1/grade | カード鑑定実行（multipart/form-data） |
| GET | /api/v1/grade/{id} | 鑑定結果取得 |
| GET | /api/v1/history | 鑑定履歴一覧 |
| DELETE | /api/v1/history/{id} | 鑑定結果削除 |

## 対応カードタイプ

- **スタンダード** (63x88mm): ポケモンカード、MTGなど
- **スモール** (59x86mm): 遊戯王など
