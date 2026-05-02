-- 値上がりランキング RPC (v3)
--
-- 005 を `create or replace` で上書きする。v2 から差分:
--   * image_url のプレースホルダ (spacer.gif / noimage 系) も除外。
--     v2 では image_url is not null チェックだけだったので、
--     "https://www.tcg-raftel.com/.../spacer.gif" のような placeholder URL を
--     持つカードが Top に紛れることがあった。
--
-- 適用: Supabase Dashboard > SQL Editor に貼り付けて実行。

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
    having count(distinct source) >= 2
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
    having count(distinct source) >= 2
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
    and lower(c.image_url) not like '%spacer.gif%'
    and lower(c.image_url) not like '%noimage%'
    and lower(c.image_url) not like '%no_image%'
    and lower(c.image_url) not like '%no-image%'
    and lower(c.image_url) not like '%/blank.gif%'
    and p.median_price >= 300
    and abs(n.median_price - p.median_price) >= 50
    and ((n.median_price - p.median_price) / p.median_price * 100) <= 500
  order by pct_change desc
  limit p_limit;
$$;

grant execute on function trending_cards(text, int, text, int) to anon, authenticated;
