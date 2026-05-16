/**
 * Client Component 用 Supabase クライアント (ブラウザで動く)
 *
 * ログインボタン押下、コレクション追加/削除など UI 操作はこちら経由。
 */
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
