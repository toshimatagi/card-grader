"use client";

/**
 * 「📚 コレクションに追加」ボタン + 状態 (grade) 選択。
 *
 * - 未ログイン: クリックで Google OAuth 起動
 * - ログイン済: grade ドロップダウン + 追加/削除 + quantity 操作
 *
 * Phase 2-A.2: grade 列を追加。同じ card_id でも grade が異なれば別行として
 * 保有できる (例: Raw 2枚 + PSA10 1枚)。
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export const GRADE_OPTIONS: { value: Grade; label: string }[] = [
  { value: "unspecified", label: "未指定" },
  { value: "raw",  label: "Raw (未鑑定)" },
  { value: "psa10", label: "PSA 10" },
  { value: "psa9",  label: "PSA 9" },
  { value: "psa8",  label: "PSA 8" },
  { value: "psa7",  label: "PSA 7" },
  { value: "bgs10", label: "BGS 10" },
  { value: "bgs9_5", label: "BGS 9.5" },
  { value: "bgs9",  label: "BGS 9" },
  { value: "ars10", label: "ARS 10" },
  { value: "ars9",  label: "ARS 9" },
  { value: "sgc10", label: "SGC 10" },
];

export type Grade =
  | "unspecified" | "raw"
  | "psa10" | "psa9" | "psa8" | "psa7"
  | "bgs10" | "bgs9_5" | "bgs9" | "bgs8_5"
  | "ars10" | "ars9"
  | "sgc10" | "sgc9_5" | "sgc9";

export type ExistingEntry = { quantity: number; grade: Grade };

export default function AddToCollection({
  cardId,
  variantLabel,
  authEnabled,
  loggedIn,
  existing,
  defaultGrade = "unspecified",
  compact = false,
}: {
  cardId: string;
  variantLabel?: string;        // "通常 R" 等、UI ヒント
  authEnabled: boolean;
  loggedIn: boolean;
  existing: ExistingEntry[];    // 同じ card_id の全 grade 行
  defaultGrade?: Grade;
  compact?: boolean;            // price table 行内で使う時の小型化
}) {
  const router = useRouter();
  const [grade, setGrade] = useState<Grade>(defaultGrade);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!authEnabled) return null;

  // 選択中 grade で既存行があるか
  const selected = existing.find((e) => e.grade === grade);
  const qty = selected?.quantity ?? 0;

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
                window.location.pathname + window.location.search,
              )}`,
            },
          });
        }}
        disabled={busy}
        className={
          compact
            ? "px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded disabled:opacity-50"
            : "w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-medium disabled:opacity-50"
        }
      >
        📚 コレクションに追加 (Googleログイン)
      </button>
    );
  }

  const sumQty = existing.reduce((s, e) => s + e.quantity, 0);

  return (
    <div className={compact ? "flex items-center gap-1 flex-wrap" : "bg-white border rounded p-3"}>
      {!compact && variantLabel && (
        <div className="text-xs text-gray-500 mb-2">
          このカード ({variantLabel}) をコレクションに追加:
        </div>
      )}
      <div className="flex items-center gap-1 flex-wrap">
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value as Grade)}
          disabled={busy}
          className="text-xs border rounded px-2 py-1 bg-white"
          aria-label="カード状態"
        >
          {GRADE_OPTIONS.map((g) => {
            const existingForG = existing.find((e) => e.grade === g.value);
            return (
              <option key={g.value} value={g.value}>
                {g.label}{existingForG ? ` (保有 ${existingForG.quantity}枚)` : ""}
              </option>
            );
          })}
        </select>
        {qty === 0 ? (
          <button
            type="button"
            onClick={() => updateQty(1)}
            disabled={busy}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded disabled:opacity-50"
          >
            {busy ? "..." : "+ 追加"}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy || qty <= 1}
              onClick={() => updateQty(qty - 1)}
              className="w-6 h-6 border rounded bg-white text-xs hover:bg-gray-50 disabled:opacity-30"
              aria-label="1枚減らす"
            >−</button>
            <span className="text-xs font-mono w-7 text-center font-bold text-green-800">
              {qty}枚
            </span>
            <button
              type="button"
              disabled={busy || qty >= 99}
              onClick={() => updateQty(qty + 1)}
              className="w-6 h-6 border rounded bg-white text-xs hover:bg-gray-50 disabled:opacity-30"
              aria-label="1枚追加"
            >+</button>
            <button
              type="button"
              onClick={() => updateQty(0)}
              disabled={busy}
              className="text-[10px] text-gray-400 hover:text-red-700 px-1"
              aria-label="削除"
            >✕</button>
          </>
        )}
      </div>
      {sumQty > 0 && (
        <p className={`text-[11px] text-green-700 ${compact ? "ml-1" : "mt-1"}`}>
          ✓ 保有合計 {sumQty}枚 (grade別)
        </p>
      )}
      {msg && <p className="text-[11px] text-red-700 mt-1">{msg}</p>}
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
        .eq("card_id", cardId)
        .eq("grade", grade);
      if (error) setMsg("削除に失敗しました");
    } else {
      const { error } = await supabase
        .from("user_collections")
        .upsert(
          { user_id: user.id, card_id: cardId, grade, quantity: next },
          { onConflict: "user_id,card_id,grade" },
        );
      if (error) setMsg("更新に失敗しました");
    }
    setBusy(false);
    router.refresh();
  }
}
