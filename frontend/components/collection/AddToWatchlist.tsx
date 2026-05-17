"use client";

/**
 * カード詳細ページの「⭐ ウォッチに追加」ボタン。
 *
 * - 未ログイン: クリックで Google OAuth 起動
 * - 未追加: 「ウォッチに追加」ボタン (alert_below は後で設定可)
 * - 追加済: 「✓ ウォッチ中」+ alert_below 編集フォーム + 解除ボタン
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export type WatchEntry = {
  alert_below: number | null;
  note: string | null;
};

export default function AddToWatchlist({
  cardId,
  authEnabled,
  loggedIn,
  existing,
  currentSellPrice,
}: {
  cardId: string;
  authEnabled: boolean;
  loggedIn: boolean;
  existing: WatchEntry | null;
  currentSellPrice: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [alertBelow, setAlertBelow] = useState<number | "">(
    existing?.alert_below ?? (currentSellPrice ? Math.floor(currentSellPrice * 0.85) : ""),
  );
  const [msg, setMsg] = useState<string | null>(null);

  if (!authEnabled) return null;

  if (!loggedIn) {
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
        className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded font-medium disabled:opacity-50"
      >
        ⭐ ウォッチに追加 (Googleログイン)
      </button>
    );
  }

  if (!existing) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded p-3">
        <div className="text-xs text-amber-900 mb-2 font-medium">
          ⭐ 価格ウォッチ — 指定値を下回ったら通知 (任意)
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-700">¥</span>
          <input
            type="number"
            value={alertBelow}
            onChange={(e) => setAlertBelow(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value)))}
            step={100}
            min={0}
            placeholder={currentSellPrice ? `${Math.floor(currentSellPrice * 0.85)}` : "1000"}
            className="w-32 border rounded px-2 py-1 text-sm tabular-nums bg-white"
          />
          <span className="text-xs text-gray-600">以下になったら通知</span>
          <button
            type="button"
            onClick={() => upsert(alertBelow === "" ? null : alertBelow)}
            disabled={busy}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded font-medium disabled:opacity-50"
          >
            {busy ? "..." : "ウォッチ開始"}
          </button>
        </div>
        {msg && <p className="text-[11px] text-red-700 mt-1">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="bg-amber-100 border border-amber-300 rounded p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <span className="text-sm text-amber-900 font-bold">
          ✓ ウォッチ中
          {existing.alert_below != null && (
            <span className="ml-2 text-xs font-normal text-amber-800">
              ¥{existing.alert_below.toLocaleString()} 以下で通知
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="text-xs text-amber-700 hover:text-red-700 px-2 underline disabled:opacity-50"
        >
          ウォッチ解除
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-amber-800">通知ライン変更:</span>
        <input
          type="number"
          value={alertBelow}
          onChange={(e) => setAlertBelow(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value)))}
          step={100}
          min={0}
          className="w-28 border rounded px-2 py-1 text-xs tabular-nums bg-white"
        />
        <button
          type="button"
          onClick={() => upsert(alertBelow === "" ? null : alertBelow)}
          disabled={busy}
          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded disabled:opacity-50"
        >
          更新
        </button>
      </div>
      {msg && <p className="text-[11px] text-red-700 mt-1">{msg}</p>}
    </div>
  );

  async function upsert(below: number | null) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("user_watchlist")
      .upsert(
        { user_id: user.id, card_id: cardId, alert_below: below },
        { onConflict: "user_id,card_id" },
      );
    if (error) setMsg("更新に失敗しました");
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (busy) return;
    if (!confirm("このカードのウォッチを解除しますか?")) return;
    setBusy(true);
    setMsg(null);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("user_watchlist")
      .delete()
      .eq("user_id", user.id)
      .eq("card_id", cardId);
    if (error) setMsg("削除に失敗しました");
    setBusy(false);
    router.refresh();
  }
}
