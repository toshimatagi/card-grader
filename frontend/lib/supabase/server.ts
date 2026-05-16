/**
 * Server Component / Route Handler 用 Supabase クライアント (認証ユーザー context)
 *
 * 既存の lib/supabase.ts (SERVICE_KEY で価格DBを叩く管理用) とは別物。
 * こちらは ANON_KEY + Cookie session で「現在のログインユーザー」として動く。
 * RLS が効くのでユーザー自身のデータしか触れない。
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component から setAll が呼ばれるのは middleware 経由のみ。
            // それ以外 (page.tsx 内など) は無視して OK
          }
        },
      },
    },
  );
}
