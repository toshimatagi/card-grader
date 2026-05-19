-- 013: trending_cards_v3 — min_sources パラメータ追加 (pokemon でも値上がり率を出すため)
--
-- v2 は count(distinct source) >= 2 を強制するため、pokemon (実質 toretoku 1
-- source) が結果0件になる問題があった。p_min_sources を取れる v3 を追加。
-- pokemon は p_min_sources=1, onepiece は従来通り p_min_sources=2 で運用。

create or replace function trending_cards_v3(
  p_brand text,
  p_period_hours int,
  p_price_type text default 'sell',
  p_limit int default 50,
  p_min_sources int default 2
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
as $$
  with now_per_source as (
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
    having count(distinct source) >= p_min_sources
  ),
  past_per_source as (
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
    having count(distinct source) >= p_min_sources
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
    and c.image_url is not null
    and c.image_url <> ''
    and p.median_price >= 300
    and abs(n.median_price - p.median_price) >= 50
    and ((n.median_price - p.median_price) / p.median_price * 100) <= 500
  order by pct_change desc
  limit p_limit;
$$;

comment on function trending_cards_v3 is
  'trending_cards v2 + p_min_sources。pokemon の様な単一ソース brand で min_sources=1 を許容';
