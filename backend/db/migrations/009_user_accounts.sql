-- 009: ユーザーアカウント基盤 (Supabase Auth + Google OAuth 前提)
--
-- Phase 2-A スコープ:
--   - user_profiles: 表示名と将来の課金プラン保管 (PII最小化: email は持たない)
--   - user_collections: コレクション (持ち物リスト)
--
-- 全テーブル RLS 有効化、auth.uid() で「自分のデータしか触れない」を DB レベル強制。
-- Supabase Dashboard SQL Editor で手動実行が必要 (service_role 経由の DDL は CI 不可)。
--
-- 適用先: https://supabase.com/dashboard/project/zbtwiopunoiyhegslbhl/sql/new

-- =============================================================================
-- user_profiles
-- =============================================================================
create table if not exists public.user_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,           -- Google avatar をユーザーが希望時のみコピー
  plan          text not null default 'free' check (plan in ('free','pro','premium')),
  stripe_customer_id text,      -- 将来の課金導入時に紐付け
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.user_profiles is
  'ユーザープロフィール。auth.users とは別に display_name 等の app 固有データを持つ。email はここに持たない (auth.users 側のみで管理)';

-- updated_at 自動更新
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- 初回ログイン時に user_profiles 行を自動作成
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, display_name, avatar_url)
  values (
    new.id,
    -- Google OAuth の raw_user_meta_data.full_name を初期値に。空なら 'ユーザー'
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', 'ユーザー'),
    null  -- avatar_url は初期は持たない、ユーザーが希望時にUIから取得
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own" on public.user_profiles
  for select using (auth.uid() = id);

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own" on public.user_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- insert は trigger からのみ (service_role 経由) なので一般ユーザーには不要

-- =============================================================================
-- user_collections (コレクション = 持ち物リスト)
-- =============================================================================
create table if not exists public.user_collections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  card_id         uuid not null references public.cards(id) on delete cascade,
  quantity        integer not null default 1 check (quantity > 0),
  condition_note  text,             -- ユーザー任意メモ ("PSA10提出予定", "傷あり" 等)
  acquired_price  integer,          -- 取得価格 (任意、含み損益計算用)
  added_at        timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, card_id)         -- 同一カードは1行 (quantity でカウント)
);

comment on table public.user_collections is
  'ユーザーの所有カード。card_id は cards.id (variant単位 = set_code+card_no+variant)。同じcard_idは1行、複数枚は quantity で表現';

create index if not exists idx_user_collections_user on public.user_collections(user_id);
create index if not exists idx_user_collections_card on public.user_collections(card_id);

drop trigger if exists trg_user_collections_updated_at on public.user_collections;
create trigger trg_user_collections_updated_at
  before update on public.user_collections
  for each row execute function public.set_updated_at();

-- RLS
alter table public.user_collections enable row level security;

drop policy if exists "user_collections_all_own" on public.user_collections;
create policy "user_collections_all_own" on public.user_collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
