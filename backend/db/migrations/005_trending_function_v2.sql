-- 値上がりランキング RPC (v2)
--
-- 既存 003_trending_function.sql を `create or replace` で上書きする。
-- 主な変更点:
--   1. 画像URLが無いカードを除外 (B-4: No Image を Top3 に出さない)
--   2. now / past それぞれソース数 ≥ 2 を要求 (単独ソースの外れ値カット)
--   3. past_price ≥ 300 (低価格ベースの%暴騰を防ぐ。¥100→¥10,000 みたいな現象除外)
--   4. pct_change ≤ 500% で頭打ち (誤データ・特殊版混入対策。+5682% みたいな異常値除外)
--   5. abs change ≥ 50 (現状維持、ノイズ除外)
--
-- 適用: Supabase Dashboard > SQL Editor に貼り付けて実行。
-- 副作用なし (戻り値の型は v1 と同一)。

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
    having count(distinct source) >= 2  -- ソース2以上必須
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
    having count(distinct source) >= 2  -- ソース2以上必須
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
    and c.image_url <> ''                                                                  -- 画像欠落カードを除外
    and p.median_price >= 300                                                              -- ベース価格下限
    and abs(n.median_price - p.median_price) >= 50                                         -- ノイズ除外
    and ((n.median_price - p.median_price) / p.median_price * 100) <= 500                  -- 上限ガード
  order by pct_change desc
  limit p_limit;
$$;

grant execute on function trending_cards(text, int, text, int) to anon, authenticated;
