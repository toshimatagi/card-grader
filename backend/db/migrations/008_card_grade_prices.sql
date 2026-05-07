-- =============================================================================
-- 008: グレード別 (Raw / PSA10 / PSA9 / BGS) 価格スナップショット
-- =============================================================================
-- PriceCharting 的な「状態別の相場」を提供するためのテーブル。
-- price_snapshots は店舗別 sell/buy 価格 (基本 Raw 想定) を時系列で持つが、
-- グレード別はサンプル数が少なく外部ソース (eBay / メルカリ) 由来なので
-- 集計済みの median/min/max/sample_count を保存する別テーブルに切り出す。

create table if not exists card_grade_prices (
  id            bigserial primary key,
  card_id       uuid not null references cards(id) on delete cascade,
  grade         text not null,            -- 'raw' | 'psa10' | 'psa9' | 'psa8' | 'bgs10' | 'bgs9.5'
  source        text not null,            -- 'mercari' | 'ebay' | 'manual'
  captured_at   timestamptz not null default now(),
  price_median  integer,                  -- JPY 中央値
  price_min     integer,
  price_max     integer,
  sample_count  integer not null default 0,
  raw           jsonb                     -- 取得時の生データ・サンプル URL 等
);

-- 同一 (card_id, grade, source) で日次粒度の最新を取得する用途に最適化
create index if not exists idx_cgp_card_grade_captured
  on card_grade_prices (card_id, grade, captured_at desc);
create index if not exists idx_cgp_grade_captured
  on card_grade_prices (grade, captured_at desc);
create index if not exists idx_cgp_source_captured
  on card_grade_prices (source, captured_at desc);

-- =============================================================================
-- RLS: 公開読み取り、書き込みは service_role のみ
-- =============================================================================
alter table card_grade_prices enable row level security;

drop policy if exists "card_grade_prices read" on card_grade_prices;
create policy "card_grade_prices read"
  on card_grade_prices for select
  using (true);

-- =============================================================================
-- 最新グレード別価格を card_id × grade で1行ずつ返すビュー
-- =============================================================================
create or replace view card_grade_prices_latest as
select distinct on (card_id, grade)
  card_id,
  grade,
  source,
  captured_at,
  price_median,
  price_min,
  price_max,
  sample_count
from card_grade_prices
order by card_id, grade, captured_at desc;

comment on table card_grade_prices is
  'グレード別 (Raw/PSA10/PSA9/BGS等) 価格集計。メルカリ売り切れ・eBay sold から日次集計。';
