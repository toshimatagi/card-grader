/**
 * /auth/callback — Google OAuth から戻ってくる先
 *
 * Supabase が code を ?code=xxx で付けて redirect してくる。
 * exchangeCodeForSession() で session 確立 → 元ページへ戻す。
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${url.origin}${next}`);
    }
  }

  // 失敗時はエラー表示ページへ
  return NextResponse.redirect(`${url.origin}/auth/error`);
}
