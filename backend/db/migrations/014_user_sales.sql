-- 014: 売却記録テーブル
--
-- ユーザーがカードを売却した記録を管理する。
-- コレクション (user_collections) の quantity を減算しつつ、
-- 売却価格・プラットフォーム・損益を永続記録する。
--
-- 適用先: https://supabase.com/dashboard/project/zbtwiopunoiyhegslbhl/sql/new

create table if not exists public.user_sales (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  card_id               uuid references public.cards(id) on delete set null,
  grade                 text not null default 'unspecified',
  quantity_sold         integer not null check (quantity_sold > 0),
  sale_price_per_card   integer not null check (sale_price_per_card >= 0),
  acquired_price        integer,          -- 売却時点の取得単価スナップショット（損益計算用）
  platform              text,             -- メルカリ / ヤフオク / カードショップ 等
  sold_at               date not null default current_date,
  note                  text,
  created_at            timestamptz not null default now()
);

comment on table public.user_sales is
  '売却記録。card_id は cards.id。acquired_price は売却時点の取得単価スナップショット。';

create index if not exists idx_user_sales_user on public.user_sales(user_id);
create index if not exists idx_user_sales_card on public.user_sales(card_id);
create index if not exists idx_user_sales_sold_at on public.user_sales(user_id, sold_at desc);

alter table public.user_sales enable row level security;

drop policy if exists "user_sales_all_own" on public.user_sales;
create policy "user_sales_all_own" on public.user_sales
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
