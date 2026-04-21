-- TCG価格推移データベース用スキーマ
-- 実行: Supabase Dashboard > SQL Editor に貼り付けて実行

-- =============================================================================
-- cards : 正規化されたカード（型番 × バリアント × レアリティ = 1行）
-- =============================================================================
create table if not exists cards (
  id          uuid primary key default gen_random_uuid(),
  brand       text not null,                        -- 'onepiece' | 'pokemon' | ...
  set_code    text not null,                        -- 'OP15' | 'ST30' | 'EB04' | 'PRB01' | 'P'
  card_no     text not null,                        -- '050' | '001'
  variant     text not null default 'normal',       -- 'normal'|'parallel'|'super_parallel'|'manga'|'alt_art'|'other'
  rarity      text not null,                        -- 'C'|'UC'|'R'|'SR'|'SEC'|'L'|'SP'|'P' 等
  name_ja     text not null,
  name_en     text,
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (brand, set_code, card_no, variant, rarity)
);

create index if not exists idx_cards_set_code_card_no on cards (set_code, card_no);
create index if not exists idx_cards_brand on cards (brand);

-- =============================================================================
-- card_external_ids : 外部サイトID対応表（名寄せ用）
-- =============================================================================
create table if not exists card_external_ids (
  card_id         uuid not null references cards(id) on delete cascade,
  source          text not null,          -- 'yuyutei'|'surugaya'|'cardrush'|'toretoku'
  source_card_id  text not null,          -- 各サイトのID（URLパスや商品コード）
  source_url      text,
  created_at      timestamptz not null default now(),
  primary key (card_id, source)
);

create index if not exists idx_ext_source_card on card_external_ids (source, source_card_id);

-- =============================================================================
-- price_snapshots : 時系列価格データ
-- =============================================================================
create table if not exists price_snapshots (
  id            bigserial primary key,
  card_id       uuid not null references cards(id) on delete cascade,
  source        text not null,
  captured_at   timestamptz not null default now(),
  price_type    text not null,            -- 'sell' (販売価格) | 'buy' (買取価格)
  price         integer,                  -- JPY, 在庫切れは null
  stock_status  text,                     -- 'in_stock'|'low'|'out'|null
  raw           jsonb
);

create index if not exists idx_snap_card_captured on price_snapshots (card_id, captured_at desc);
create index if not exists idx_snap_source_captured on price_snapshots (source, captured_at desc);
create index if not exists idx_snap_captured on price_snapshots (captured_at desc);

-- =============================================================================
-- crawl_runs : クロール実行ログ（失敗調査用）
-- =============================================================================
create table if not exists crawl_runs (
  id            bigserial primary key,
  source        text not null,
  scope         text,                     -- 'hot'|'warm'|'cold'|'set:OP15' など
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text,                     -- 'running'|'success'|'partial'|'failed'
  items_count   integer default 0,
  error         text
);

create index if not exists idx_runs_source_started on crawl_runs (source, started_at desc);

-- =============================================================================
-- RLS : 読み取りは匿名公開、書き込みは service_role のみ
-- =============================================================================
alter table cards enable row level security;
alter table card_external_ids enable row level security;
alter table price_snapshots enable row level security;
alter table crawl_runs enable row level security;

drop policy if exists "public read cards" on cards;
create policy "public read cards" on cards for select to anon, authenticated using (true);

drop policy if exists "public read price_snapshots" on price_snapshots;
create policy "public read price_snapshots" on price_snapshots for select to anon, authenticated using (true);

drop policy if exists "public read card_external_ids" on card_external_ids;
create policy "public read card_external_ids" on card_external_ids for select to anon, authenticated using (true);
-- crawl_runs は公開しない（service_role のみ）
