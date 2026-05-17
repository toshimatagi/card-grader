-- 012: 新規ユーザー登録時の Discord 通知 webhook
--
-- user_profiles に INSERT されたら、/api/webhooks/new-user に POST して
-- 管理者の Discord に通知を飛ばす。pg_net 拡張使用。
--
-- ※ WEBHOOK_SECRET は SQL に直書きしている (Postgres内に閉じるので OK、
--   API 側で同値検証することで第三者 POST を弾く)。
--   secret 変更時はこの migration を再実行。

-- pg_net 拡張を有効化 (Supabase デフォルトでは無効)
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_user_webhook()
returns trigger
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  webhook_url text := 'https://tcg-authority.com/api/webhooks/new-user';
  webhook_secret text := 'CR4g0weVlsPOSYq0IG1Qe6vQlIo9sz3NWw-p6AkFMfw';
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'user_profiles',
    'schema', 'public',
    'record', row_to_json(NEW),
    'old_record', null
  );

  -- 非同期 POST (失敗してもユーザー作成は止めない)
  perform net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := payload,
    timeout_milliseconds := 3000
  );
  return NEW;
exception when others then
  -- webhook 失敗時もユーザー登録は成功させる
  raise notice 'notify_new_user_webhook failed: %', sqlerrm;
  return NEW;
end;
$$;

comment on function public.notify_new_user_webhook is
  '新規ユーザー登録時に Vercel API → Discord webhook へ通知を飛ばす';

-- 既存 trigger を一旦削除して張り直し (idempotent)
drop trigger if exists trg_user_profiles_notify on public.user_profiles;
create trigger trg_user_profiles_notify
  after insert on public.user_profiles
  for each row execute function public.notify_new_user_webhook();
