# 鑑定機能 改善タスク一覧

2026-07 の監査で洗い出した改善タスク。**上から順に着手する**（安定性 → 安全網 → 精度の順）。
各タスクは独立したセッションで完結できるよう、背景・対象ファイル・完了条件を自己完結で書いてある。

## 共通コンテキスト（全タスク共通の前提）

- 構成・起動方法・デプロイ注意は `CLAUDE.md` を参照
- **鑑定パイプライン**: `backend/services/grading.py` の `grade_card()` がオーケストレーター。
  centering は Gemini 2-call AI（`services/gemini_identify.py` の `analyze_centering_ai_2call`）→ 失敗時 OpenCV フォールバック。
  surface は縮小前画像（長辺1200px）で解析し、閾値は 800px 基準から `res` スケールで正規化済み（`services/surface.py`）
- **レスポンス契約**: `/api/v1/grade` の `card_image` / `overlay_images` の値は、Storage アップロード成功時は**公開URL**、失敗時は **base64**。フロントは `GradeResultView.tsx` の `imageSrc()` が両対応。この契約を壊さないこと
- **grade_card は同期関数**で、ルーター（`routers/grade.py`）から `run_in_threadpool` で呼ばれる。async 化する場合はルーター側も合わせて変更
- **オフライン実行**: `GEMINI_API_KEY="" Gemini_API_Key=""` を設定すると AI をスキップして OpenCV 経路（決定的）になる。テスト画像は `images/IMG_*.JPG`
- **httpx 0.28 の罠**: `client.delete()` は `json=` ボディ非対応。ボディ付き DELETE は `client.request("DELETE", ...)` を使う（過去にこれで削除APIが全滅した）
- **検証の作法**: 本番 API でテスト鑑定した場合は `DELETE /api/v1/history/{id}` で必ず掃除する
- Supabase は ramen-roppou と同一プロジェクト（ref: `xhjdzkpfgybcsuesasqj`）。スキーマ変更は SQL ファイルをリポジトリに残す（`backend/db/migrations/` を新設して置く）

---

## [x] P1-1: pHash キャッシュ（AI測定の再現性確保）【最優先】

**完了（2026-07-07）**: テーブル `ai_centering_cache`（`backend/db/migrations/015_ai_centering_cache.sql`、番号は既存連番に合わせ 015）を Supabase に作成。`db/supabase_client.py` に同期ベストエフォートの `get_centering_cache` / `save_centering_cache` を追加し、`grading.py` の `_analyze_centering_with_ai()` で pHash 照合を組み込み。ローカル検証で同一画像 2 回鑑定 → 2 回目が `[centering] cache hit` を出し Gemini を呼ばず同一値（centering 8.5 / borders 24,19,25,36）を返すことを確認。

**背景**: Gemini 測定は非決定的で、同じ画像の再鑑定でスコアが変わる。手動補正後の再実行が典型で、そのたびに Gemini 2 コールの費用と 503 リスクも発生。

**方針**:
1. テーブル `ai_centering_cache`（`phash text primary key, result jsonb, model text, created_at timestamptz default now()`）を作成。SQL は `backend/db/migrations/001_ai_centering_cache.sql` に保存し、Supabase SQL Editor で適用
2. `grading.py` の `_analyze_centering_with_ai()` 内、Gemini 呼び出しの前に `services/phash.py` の `compute_phash(card_image)` でキーを作りキャッシュ照合。ヒットしたら Gemini を呼ばず保存値を使う。ミス時は測定後に保存
3. grade_card は同期なので、キャッシュ照合は **同期 httpx**（`httpx.Client`）で Supabase REST を叩く小関数を `db/supabase_client.py` に追加（`_headers()` を流用）。失敗してもエラーにせず素通し（キャッシュはベストエフォート）

**完了条件**: 同一画像を 2 回鑑定して、2 回目が Gemini を呼ばず（ログ `[centering] cache hit` を出す）同一の centering 数値を返す
**検証**: ローカルで uvicorn を起動し同じ画像を 2 回 POST。応答の `sub_grades.centering` が完全一致すること
**規模**: 小〜中（半日）

## [x] P1-2: 測定モードのバッジ表示

**完了（2026-07-08）**: `GradeResultView.tsx` に `centeringModeBadge()` を追加し、センタリング詳細の先頭に 🤖 AI測定 / 📐 自動測定 / ✋ 手動測定 のバッジを表示。手動調整中（`adjustedCentering`）と `detail.mode==="manual"` は手動、`gemini_ai_2call` は AI、未設定は自動。共有ビュー（`grade/[id]`）・アップロード結果（`GradeApp`）とも同コンポーネント経由で表示。`npx tsc --noEmit` パス。

**背景**: 結果が AI 測定か OpenCV 自動か手動かで信頼性が違うのに、UI で区別できない。`sub_grades.centering.detail.mode` に `gemini_ai_2call` / `manual` 等が既に入っている（OpenCV フォールバック時は mode 未設定 = None なので「自動測定」として扱う）。

**方針**: `frontend/components/result/GradeResultView.tsx` のセンタリングセクションに小さいバッジを追加（🤖 AI測定 / 📐 自動測定 / ✋ 手動測定）。共有ビューでも表示されること。
**完了条件**: 3 モードそれぞれでバッジが正しく出る。`npx tsc --noEmit` パス
**規模**: 小（1時間）

## P1-3: ゴールデン回帰テスト + CI

**背景**: 鑑定ロジックの閾値変更が過去のカードで劣化していないかを検証する仕組みがない。すべて手動確認。

**方針**:
1. `backend/tests/test_golden.py` を新規作成。`GEMINI_API_KEY=""` で AI をスキップし **OpenCV 経路（決定的）** のみをテストする
2. 初期ゴールデン値（2026-07 実測、許容 ±0.5）:
   - `images/IMG_2958.JPG` brand=onepiece: overall≈8.0（centering 10.0 / surface 9.5 / color 7.5 / edges 5.0）
   - `images/IMG_2853.JPG` brand=onepiece: overall≈8.5（centering 8.5 / surface 10.0 / color 7.0 / edges 7.5）
3. スコアだけでなく `detail.defects` の件数レンジ、color_border の検出成功（比率フォールバックに落ちていないこと）も assert
4. `.github/workflows/test.yml` を新設: push 時に `pip install -r backend/requirements.txt && pytest backend/tests/`。opencv-python-headless なので CI で動く
5. pytest を `backend/requirements.txt` ではなく `backend/requirements-dev.txt`（新設）に入れる

**完了条件**: ローカルと GitHub Actions の両方で pytest がグリーン
**規模**: 中（半日）

## P1-4: サブ分析の並列化

**背景**: centering(AI) → color → surface → edges が直列。Gemini 往復（数秒〜数十秒）の間 CPU が遊んでいる。

**方針**: `grading.py` 内で `concurrent.futures.ThreadPoolExecutor` を使い、
「centering（AI 呼び出し込み）」と「color → surface + edges（is_holo 依存があるので color が先）」の 2 系統を並列実行。
grade_card 自体は同期のままでよい（既に threadpool 上で動いている）。
**注意**: 手動センタリング経路（`manual_centering` あり）は AI を呼ばないので並列化の対象外でよい
**完了条件**: P1-3 のゴールデンテストがグリーンのまま、AI 経路の合計レイテンシが「Gemini 応答時間 + α」に短縮
**検証**: ログにフェーズ別時間を出して before/after を比較
**規模**: 小〜中（半日）

## P1-5: 手動確定値の永続化と AI 差分ログ

**背景**: 結果画面の手動センタリング調整（`GradeResultView.tsx` の `adjustedCentering`）は**クライアント状態のみで保存されない**。手動確定値は AI の系統誤差を測る唯一の教師データなのに捨てている。

**方針**:
1. `PATCH /api/v1/grade/{id}/centering` を新設し、手動調整値（lr/tb 比率、4辺 px、inner/outer corners）を `gradings` テーブルに保存（`sub_grades` jsonb の `centering.manual_adjusted` に追記 or 専用カラム）
2. フロントの調整確定時（`onComplete`）に PATCH を呼ぶ
3. 集計クエリ（SQL ファイルとして保存）: AI 測定値 vs 手動確定値の辺ごとの平均差分・分布。「AI は上マージンを過小評価しがち」のような系統誤差を可視化できる形
**完了条件**: 手動調整→リロードしても調整値が表示される。集計 SQL が動く
**規模**: 中（1日）

## P2-1: グレア検出 → 再撮影誘導

**背景**: 強い反射（グレア）があると surface の傷検出が無意味になるが、現在は黙って誤鑑定を返す。

**方針**: `services/image_validation.py` に飽和ハイライト率の検査を追加（HSV の V>250 かつ S<30 の画素率が閾値超、ホロは誤爆しやすいので閾値高め）。鑑定は**拒否せず**、レスポンスに `warnings: [{type: "glare", message: "..."}]` を追加し、フロントで「照明を斜めにして撮り直すと精度が上がります」バナー表示。
**完了条件**: グレアありサンプル画像で warning が出て、通常画像では出ない
**規模**: 中（半日〜1日）

## P2-2: スコアのレンジ表示

**背景**: 単一値「8.5」は PSA 実グレードとズレた瞬間に信頼を失う。confidence を表示上のレンジに変換する。

**方針**: `grading.py` の `_calculate_confidence` の結果と各要因（AI confidence、is_holo、グレア warning）から `grade_range: {min, max}` を算出してレスポンスに追加（例: confidence 1.0 → ±0.5、0.6 → ±1.0）。フロントの ScoreGauge 周辺に「8.0〜9.0（最有力 8.5）」表示。
**完了条件**: confidence の低い鑑定でレンジが広がることをテストで確認
**規模**: 中（1日）

## P2-3: surface/edges の AI ハイブリッド化【大物】

**背景**: 総合スコアの 6 割（surface 35% + edges 25%）が OpenCV ヒューリスティクスのまま。センタリングで実証済みの「AI 2-call パターン」を水平展開する。

**方針**:
1. OpenCV 検出（`surface.py`）を recall 重視に緩めて「候補領域の提案器」に降格
2. 候補領域の高解像度クロップ（縮小前画像から切り出し）を Gemini に渡し「印刷模様/ホロ柄 or 実ダメージ（種類と深刻度）」を分類させる。`gemini_identify.py` の 2-call 実装（モデルフォールバック・リトライ込み）を流用
3. P1-1 のキャッシュ機構を surface にも適用（phash + region キー）
4. **必ず P1-3 のゴールデンテストを先に整備してから着手**（挙動が大きく変わるため）
**完了条件**: ホロカード（IMG_2875 系）で印刷パターンの誤検出が減り、ゴールデンテストの許容レンジ内
**規模**: 大（2〜3日）

## P2-4: 公式サンプル画像によるカード別リファレンス基盤

**背景**: センタリングの内枠検出はブランド単位のざっくり比率（`card_layouts.py` / `border_ratios`）しかなく、ホロ・フルアートで内枠検出が不安定。公式カードリストのサンプル画像（歪みなし・全弾網羅・型番で `cards` テーブルと結合可能）をカード個体ごとの基準データにする。

**方針**:
1. 公式カードリストのサンプル画像を収集するクローラを追加（既存クローラ `.github/workflows/crawl-*` の構成を踏襲、レート制御を丁寧に）。Supabase Storage の `card-references/` バケット（非公開）に保存
2. カードごとに事前計算して新テーブル `card_reference_features` に保存:
   - デザイン内枠の位置・比率（4辺）
   - 絵柄ランドマーク（テンプレートマッチング用の特徴点）
   - pHash（既存 `phash_index` との整合）
   - **SAMPLE 透かし領域のマスク**（中央斜めの透かしは比較不能領域として除外）
3. センタリング測定に統合: ユーザー写真の内枠位置を、汎用エッジ検出ではなく**該当カードの基準画像とのテンプレート照合**で特定（識別 → 型番 → 基準取得のパスは `suggest_cards` の流れを流用）。実測（内枠→実カード端の距離）は従来どおり写真側で行う
4. 将来の差分ベース傷検出（P2-3 の候補提案器）の土台になる

**権利面の制約（must）**: 収集画像は測定用の内部参照専用。サイト上への表示・再配布には使わない。この制約をコード内コメントとバケット名で明示すること
**完了条件**: ホロ/フルアートのテストカードで、基準照合ベースの内枠位置が汎用検出より安定（ゴールデンテストに専用ケース追加）
**依存**: P1-3（ゴールデンテスト）完了後に着手。P2-3 とは独立に進められる
**規模**: 大（2〜3日、クローラ+特徴抽出+統合）

## P3（バックログ、着手前に相談）

- **PSA 実グレード較正**: eBay sold（`services/ebay.py`）から PSA グレード付き画像+実グレードを 100〜300 件収集し、`WEIGHTS`（grading.py: centering .20 / surface .35 / color .20 / edges .25）とスコア曲線を回帰で較正。「PSA◯相当の確率」表示へ
- **鑑定×価格の接続**: 鑑定結果ページに `card_grade_prices_latest`（raw/psa10 等の相場、`frontend/lib/api.ts` に取得関数あり）を結合し「鑑定に出す価値」を提示
- **インフラ**: Render → Cloud Run（東京）移行検討 / Supabase を ramen-roppou と分離 / Next.js 14→15
- **利用規約**: カード画像を Gemini（Google）に送信している旨をプライバシーポリシーに明記

---

## 進め方のルール

- 1 タスク = 1 セッション = 1 コミット を基本にする（P2-3 のみ複数コミット可）
- 着手前に `git log --oneline -5` と本ファイルを確認し、完了済みタスクにはこのファイル上で `[x]` を付けてコミットに含める
- コミット後のデプロイは CLAUDE.md の手順（フロント先行）。デプロイまでやるかはユーザーに確認
