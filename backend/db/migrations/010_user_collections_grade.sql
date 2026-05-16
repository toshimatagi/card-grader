-- 010: user_collections に grade 列を追加 (Raw/PSA10/PSA9/... の状態別保有を許容)
--
-- 同じカードを "Raw 2枚 + PSA10 1枚" のように grade 別に複数行で保有できるよう
-- unique constraint を (user_id, card_id) → (user_id, card_id, grade) に変更。

alter table public.user_collections
  add column if not exists grade text not null default 'unspecified'
    check (grade in (
      'unspecified',
      'raw',
      'psa10','psa9','psa8','psa7',
      'bgs10','bgs9_5','bgs9','bgs8_5',
      'ars10','ars9',
      'sgc10','sgc9_5','sgc9'
    ));

-- 旧 unique を外して grade 込みに張り直し
do $$
declare
  cn text;
begin
  for cn in
    select conname from pg_constraint
    where conrelid = 'public.user_collections'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (user_id, card_id)'
  loop
    execute format('alter table public.user_collections drop constraint %I', cn);
  end loop;
end $$;

create unique index if not exists user_collections_uid_cid_grade_uniq
  on public.user_collections(user_id, card_id, grade);

comment on column public.user_collections.grade is
  'カード状態: unspecified=未指定 / raw=未鑑定 / psa10..psa7 / bgs10..bgs8_5 / ars10..ars9 / sgc10..sgc9';
