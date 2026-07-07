-- AI センタリング測定のキャッシュ（再現性確保・費用/503リスク削減）
-- 実行: Supabase Dashboard > SQL Editor に貼り付けて実行
--
-- 背景: Gemini によるセンタリング測定は非決定的で、同じ画像の再鑑定でも
--   スコアが変わる（手動補正後の再実行が典型）。カード写真の pHash をキーに
--   Gemini の測定結果（left/right/top/bottom %・confidence）を保存し、
--   2 回目以降は Gemini を呼ばず保存値を再利用して同一値を返す。
--
-- キャッシュはベストエフォート。書き込み/読み出しに失敗しても鑑定は継続する。

create table if not exists ai_centering_cache (
  phash       text primary key,          -- services/phash.py の compute_phash() の hex（16文字）
  result      jsonb not null,            -- analyze_centering_ai_2call() の戻り値そのまま
  model       text,                      -- 測定に使った系統（例: 'gemini_ai_2call'）
  created_at  timestamptz not null default now()
);

comment on table ai_centering_cache is
  'AI センタリング測定の pHash キャッシュ。同一画像の再鑑定で Gemini を呼ばず再現性を担保する（P1-1）';
