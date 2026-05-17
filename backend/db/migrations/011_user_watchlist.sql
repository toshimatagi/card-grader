-- 011: 価格ウォッチリスト (狙ったカードが指定値を下回ったら通知)
--
-- 「このカードが ¥X 以下になったら知らせて」というユースケース。
-- アラート通知は当面 in-app (page badge) のみ、email 通知は後追い。

create table if not exists public.user_watchlist (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  card_id       uuid not null references public.cards(id) on delete cascade,
  -- 通知条件: sell_price がこの値以下になったら trigger
  alert_below   integer,
  -- 通知条件: psa10_price がこの値以下になったら trigger (今後の拡張用)
  alert_psa10_below integer,
  -- 最後にアラートを発火した時刻 (連発防止)
  last_alerted_at timestamptz,
  -- ユーザー自由メモ ("発売記念で安いうちに" 等)
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, card_id)
);

comment on table public.user_watchlist is
  'ユーザーが価格監視対象に指定したカード。alert_below を下回ったら通知。';

create index if not exists idx_user_watchlist_user on public.user_watchlist(user_id);
create index if not exists idx_user_watchlist_card on public.user_watchlist(card_id);

-- updated_at trigger (009 で作った関数を再利用)
drop trigger if exists trg_user_watchlist_updated_at on public.user_watchlist;
create trigger trg_user_watchlist_updated_at
  before update on public.user_watchlist
  for each row execute function public.set_updated_at();

-- RLS
alter table public.user_watchlist enable row level security;

drop policy if exists "user_watchlist_all_own" on public.user_watchlist;
create policy "user_watchlist_all_own" on public.user_watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
