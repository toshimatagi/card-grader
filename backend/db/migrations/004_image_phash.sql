-- 画像pHash（Perceptual Hash）列を追加
-- 鑑定写真からDBカードを画像マッチで特定するために使う
-- 実行: Supabase Dashboard > SQL Editor

alter table cards add column if not exists image_phash bytea;

-- pHashが計算済みのカードだけを索引（部分索引でサイズ削減）
create index if not exists idx_cards_phash_present
  on cards (id) where image_phash is not null;
