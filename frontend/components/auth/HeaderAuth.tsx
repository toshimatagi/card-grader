/**
 * ヘッダ右端の認証 UI。
 *
 * ログイン前: 「ログイン」ボタン (Google OAuth 起動)
 * ログイン後: 表示名 + ドロップダウン (コレクション / アカウント / ログアウト)
 *
 * Server Component (layout.tsx) から currentUser (server で取得済の最低限情報)
 * を props で受け取り、UI操作のみ client で実行。getUser() を client で
 * 再度叩くと SSR/CSR で別レスポンスになり ちらつくため。
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export type HeaderUser = {
  id: string;
  displayName: string | null;
};

export default function HeaderAuth({ user }: { user: HeaderUser | null }) {
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <button
        type="button"
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          const supabase = createSupabaseBrowserClient();
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
                window.location.pathname + window.location.search,
              )}`,
            },
          });
          if (error) {
            console.error(error);
            setBusy(false);
          }
        }}
        disabled={busy}
        className="text-sm hover:text-blue-400 transition-colors disabled:opacity-50"
        aria-label="Google でログイン"
      >
        {busy ? "..." : "ログイン"}
      </button>
    );
  }

  return (
    <details className="relative group [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer hover:text-blue-400 transition-colors list-none flex items-center gap-1 text-sm">
        <span className="inline-block w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
          {(user.displayName ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:inline max-w-[6em] truncate">
          {user.displayName ?? "ユーザー"}
        </span>
        <span className="text-[10px] text-gray-400 group-open:rotate-180 transition-transform">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 mt-2 w-44 rounded-md bg-gray-800 border border-gray-700 shadow-lg z-50 py-1">
        <Link href="/collection" className="block px-3 py-2 text-sm hover:bg-gray-700">
          📚 コレクション
        </Link>
        <Link href="/watchlist" className="block px-3 py-2 text-sm hover:bg-gray-700">
          ⭐ ウォッチリスト
        </Link>
        <Link href="/account" className="block px-3 py-2 text-sm hover:bg-gray-700">
          ⚙️ アカウント
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 text-gray-300"
          >
            ログアウト
          </button>
        </form>
      </div>
    </details>
  );
}
