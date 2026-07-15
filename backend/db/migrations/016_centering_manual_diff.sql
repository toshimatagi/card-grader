-- 手動センタリング確定値 vs AI 測定値の系統誤差分析（P1-5）
-- 実行: Supabase Dashboard > SQL Editor に貼り付けて実行
--
-- 背景: 結果画面の手動センタリング調整（GradeResultView の CenteringEditor）で
--   ユーザーが確定した値を、PATCH /api/v1/grade/{id}/centering 経由で
--   gradings.sub_grades.centering.detail.manual_adjusted に保存している。
--   手動確定値は AI 測定（gemini_ai_2call）の系統誤差を測る唯一の教師データなので、
--   辺ごとの差分を集計して「AI は上マージンを過小評価しがち」等の傾向を可視化する。
--
-- スキーマ変更は無し（sub_grades jsonb 内に追記しているだけ）。以下は分析用ビューのみ。

-- 1) 明細ビュー: 鑑定 1 件ごとに AI 測定値・手動確定値・辺ごとの差分（手動 - AI）を並べる。
--    diff > 0 は「手動の方が余白を大きく取った = AI が過小評価」の意味。
create or replace view ai_vs_manual_centering_diff as
select
  g.id as grading_id,
  g.created_at,
  g.sub_grades->'centering'->'detail'->>'mode' as ai_mode,
  -- AI 測定値（px）
  (g.sub_grades->'centering'->'detail'->>'left_border')::numeric   as ai_left,
  (g.sub_grades->'centering'->'detail'->>'right_border')::numeric  as ai_right,
  (g.sub_grades->'centering'->'detail'->>'top_border')::numeric    as ai_top,
  (g.sub_grades->'centering'->'detail'->>'bottom_border')::numeric as ai_bottom,
  g.sub_grades->'centering'->'detail'->>'lr_ratio' as ai_lr_ratio,
  g.sub_grades->'centering'->'detail'->>'tb_ratio' as ai_tb_ratio,
  -- 手動確定値（px）
  (g.sub_grades->'centering'->'detail'->'manual_adjusted'->>'left_border')::numeric   as manual_left,
  (g.sub_grades->'centering'->'detail'->'manual_adjusted'->>'right_border')::numeric  as manual_right,
  (g.sub_grades->'centering'->'detail'->'manual_adjusted'->>'top_border')::numeric    as manual_top,
  (g.sub_grades->'centering'->'detail'->'manual_adjusted'->>'bottom_border')::numeric as manual_bottom,
  g.sub_grades->'centering'->'detail'->'manual_adjusted'->>'lr_ratio' as manual_lr_ratio,
  g.sub_grades->'centering'->'detail'->'manual_adjusted'->>'tb_ratio' as manual_tb_ratio,
  g.sub_grades->'centering'->'detail'->'manual_adjusted'->>'saved_at' as manual_saved_at,
  -- 辺ごとの差分（手動 - AI）
  (g.sub_grades->'centering'->'detail'->'manual_adjusted'->>'left_border')::numeric
    - (g.sub_grades->'centering'->'detail'->>'left_border')::numeric   as diff_left,
  (g.sub_grades->'centering'->'detail'->'manual_adjusted'->>'right_border')::numeric
    - (g.sub_grades->'centering'->'detail'->>'right_border')::numeric  as diff_right,
  (g.sub_grades->'centering'->'detail'->'manual_adjusted'->>'top_border')::numeric
    - (g.sub_grades->'centering'->'detail'->>'top_border')::numeric    as diff_top,
  (g.sub_grades->'centering'->'detail'->'manual_adjusted'->>'bottom_border')::numeric
    - (g.sub_grades->'centering'->'detail'->>'bottom_border')::numeric as diff_bottom
from gradings g
where g.sub_grades->'centering'->'detail' ? 'manual_adjusted';

comment on view ai_vs_manual_centering_diff is
  '手動センタリング確定値と AI 測定値の明細比較（辺ごとの差分付き）。P1-5 の教師データ分析用';

-- 2) 集計ビュー: 辺ごとに AI 測定の系統誤差（平均・標準偏差）を出す。
--    mean_diff_* が正なら「AI がその辺の余白を過小評価しがち」。
create or replace view ai_vs_manual_centering_summary as
select
  ai_mode,
  count(*) as n,
  round(avg(diff_left),   2) as mean_diff_left,
  round(avg(diff_right),  2) as mean_diff_right,
  round(avg(diff_top),    2) as mean_diff_top,
  round(avg(diff_bottom), 2) as mean_diff_bottom,
  round(stddev_pop(diff_left),   2) as std_diff_left,
  round(stddev_pop(diff_right),  2) as std_diff_right,
  round(stddev_pop(diff_top),    2) as std_diff_top,
  round(stddev_pop(diff_bottom), 2) as std_diff_bottom
from ai_vs_manual_centering_diff
group by ai_mode;

comment on view ai_vs_manual_centering_summary is
  'AI 測定モード別の辺ごと系統誤差サマリ（手動 - AI の平均・標準偏差）。P1-5';
