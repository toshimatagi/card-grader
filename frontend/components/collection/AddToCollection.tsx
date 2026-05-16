"use client";

/**
 * カード詳細ページの「📚 コレクションに追加」ボタン。
 *
 * - 未ログイン: クリックで Google OAuth 起動 (現在ページに戻ってくる)
 * - ログイン済: クリックで quantity+1 (既存行があれば upsert)
 * - 追加済: 「コレクションに登録済」表示 + 数量変更フォーム
 *
 * variant 単位ではなく code 単位 (set_code+card_no) で扱うのが UX 自然なので、
 * cards テーブルから「同じ code の代表 variant の id」を server 側で渡してもらう。
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export default function AddToCollection({
  cardId,
  cardCode,
  initialState,
}: {
  cardId: string;
  cardCode: string;
  initialState: { loggedIn: boolean; quantity: number };
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(initialState.quantity);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!initialState.loggedIn) {
    return (
      <button
        type="button"
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
                window.location.pathname,
              )}`,
            },
          });
        }}
        disabled={busy}
        className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-medium disabled:opacity-50"
      >
        📚 コレクションに追加 (Googleログイン)
      </button>
    );
  }

  if (quantity === 0) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            const supabase = createSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              setBusy(false);
              return;
            }
            const { error } = await supabase.from("user_collections").upsert(
              { user_id: user.id, card_id: cardId, quantity: 1 },
              { onConflict: "user_id,card_id" },
            );
            if (error) {
              setMsg("追加に失敗しました");
              setBusy(false);
              return;
            }
            setQuantity(1);
            setMsg("追加しました");
            setBusy(false);
            router.refresh();
          }}
          disabled={busy}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-medium disabled:opacity-50"
        >
          {busy ? "追加中..." : "📚 コレクションに追加"}
        </button>
        {msg && <p className="text-xs text-gray-500">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm text-green-800 font-medium">
          ✓ コレクション登録済 ({quantity}枚)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy || quantity <= 1}
            onClick={() => updateQty(quantity - 1)}
            className="w-7 h-7 border rounded bg-white text-sm hover:bg-gray-50 disabled:opacity-30"
            aria-label="1枚減らす"
          >
            −
          </button>
          <span className="text-sm font-mono w-7 text-center">{quantity}</span>
          <button
            type="button"
            disabled={busy || quantity >= 99}
            onClick={() => updateQty(quantity + 1)}
            className="w-7 h-7 border rounded bg-white text-sm hover:bg-gray-50 disabled:opacity-30"
            aria-label="1枚追加"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => updateQty(0)}
            disabled={busy}
            className="ml-1 text-xs text-gray-500 hover:text-red-700 px-2"
            aria-label="削除"
          >
            削除
          </button>
        </div>
      </div>
      {msg && <p className="text-xs text-green-700 mt-1">{msg}</p>}
    </div>
  );

  async function updateQty(next: number) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    if (next === 0) {
      const { error } = await supabase
        .from("user_collections")
        .delete()
        .eq("user_id", user.id)
        .eq("card_id", cardId);
      if (error) {
        setMsg("削除に失敗しました");
      } else {
        setQuantity(0);
      }
    } else {
      const { error } = await supabase
        .from("user_collections")
        .upsert(
          { user_id: user.id, card_id: cardId, quantity: next },
          { onConflict: "user_id,card_id" },
        );
      if (error) {
        setMsg("更新に失敗しました");
      } else {
        setQuantity(next);
      }
    }
    setBusy(false);
    router.refresh();
  }
}
