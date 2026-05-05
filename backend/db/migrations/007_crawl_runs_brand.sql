-- crawl_runs に brand 列を追加。
-- cleanup.py が (source, brand) ペアで cutoff を計算できるようにするため。
-- 同 source (例: fullahead) で複数 brand を扱うと、brand 列がないと相互干渉して
-- スナップショット誤削除を招く (2026-04-26 / 2026-05-05 に同構造の事案あり)。
--
-- 適用方法: Supabase Dashboard > SQL Editor に貼って実行。
-- 既存 row の brand は NULL のまま残る。cleanup.py は NULL を 'onepiece' 互換として扱う。

alter table crawl_runs add column if not exists brand text;

create index if not exists idx_runs_brand_source_started
  on crawl_runs (brand, source, started_at desc);
