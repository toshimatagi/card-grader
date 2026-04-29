-- 値上がりランキング用 RPC
-- 実行: Supabase Dashboard > SQL Editor に貼り付けて実行

create or replace function trending_cards(
  p_brand text default 'onepiece',
  p_period_hours int default 168,
  p_price_type text default 'sell',
  p_limit int default 50
)
returns table (
  card_id uuid,
  set_code text,
  card_no text,
  variant text,
  rarity text,
  name_ja text,
  image_url text,
  now_price numeric,
  past_price numeric,
  pct_change numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with now_per_source as (
    -- 直近48h内の各 (card,source) 最新価格
    select distinct on (card_id, source)
      card_id, source, price
    from price_snapshots
    where captured_at >= now() - interval '48 hours'
      and price_type = p_price_type
      and price is not null
      and price >= 100
      and (stock_status is null or stock_status not in ('out', 'out_of_stock'))
    order by card_id, source, captured_at desc
  ),
  now_med as (
    select card_id,
           percentile_cont(0.5) within group (order by price) as median_price
    from now_per_source
    group by card_id
  ),
  past_per_source as (
    -- (now - period) を中心に ±48h の窓で各 (card,source) 最新価格
    select distinct on (card_id, source)
      card_id, source, price
    from price_snapshots
    where captured_at >= now() - (p_period_hours || ' hours')::interval - interval '48 hours'
      and captured_at <= now() - (p_period_hours || ' hours')::interval + interval '48 hours'
      and price_type = p_price_type
      and price is not null
      and price >= 100
      and (stock_status is null or stock_status not in ('out', 'out_of_stock'))
    order by card_id, source, captured_at desc
  ),
  past_med as (
    select card_id,
           percentile_cont(0.5) within group (order by price) as median_price
    from past_per_source
    group by card_id
  )
  select
    c.id          as card_id,
    c.set_code,
    c.card_no,
    c.variant,
    c.rarity,
    c.name_ja,
    c.image_url,
    round(n.median_price)::numeric                                                  as now_price,
    round(p.median_price)::numeric                                                  as past_price,
    round(((n.median_price - p.median_price) / p.median_price * 100)::numeric, 2)   as pct_change
  from now_med n
  join past_med p on n.card_id = p.card_id
  join cards c    on c.id      = n.card_id
  where c.brand = p_brand
    and p.median_price > 0
    and abs(n.median_price - p.median_price) >= 50  -- ノイズ除外
  order by pct_change desc
  limit p_limit;
$$;

-- anon / authenticated にも実行権限（RLSはbypassされるが入力ガードは関数内で）
grant execute on function trending_cards(text, int, text, int) to anon, authenticated;
