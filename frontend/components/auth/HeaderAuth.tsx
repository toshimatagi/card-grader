/**
 * ヘッダ右端の認証 UI (完全 client side)。
 *
 * 元は layout.tsx で cookies() 読んで user を server で取得していたが、
 * cookies() 使用が layout 全体を dynamic 化 → 全ページの ISR が効かなくなる
 * 致命的問題があった。client 側で auth state を fetch する方式に変更。
 *
 * トレードオフ: 初回表示は「ログイン」ボタンが一瞬出てから user 名に切替わる
 *   (ログイン中ユーザーのみ。匿名ユーザーには影響なし)。ISR/static の速度メリットが上回る。
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export type HeaderUser = {
  id: string;
  displayName: string | null;
};

export default function HeaderAuth() {
  const [user, setUser] = useState<HeaderUser | null>(null);
  const [busy, setBusy] = useState(false);

  // mount 後に client から auth 状態を fetch (server 側で見ない → ISR 維持)
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (cancelled || !authUser) return;
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("id", authUser.id)
        .maybeSingle();
      if (cancelled) return;
      setUser({
        id: authUser.id,
        displayName: (profile?.display_name as string | null) ?? null,
      });
    })();
    // session 変更を購読 (login/logout 時に UI 即追従)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) {
          setUser(null);
        }
        // login 時の profile 取得は↑の初回 effect でカバー
      },
    );
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

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
