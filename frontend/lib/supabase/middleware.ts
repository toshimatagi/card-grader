/**
 * Next.js middleware から呼ぶ session リフレッシャ。
 *
 * Supabase の JWT は1時間で expire するため、毎リクエストで cookie を見て
 * 必要なら refresh トークンを使って更新する。これをやらないと
 * Server Component で auth.getUser() が null になる。
 */
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // env vars 未設定の段階 (Supabase Auth 未配信) では何もせず pass through
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 重要: getUser() を呼ぶことで session refresh が走る
  await supabase.auth.getUser();

  return supabaseResponse;
}
