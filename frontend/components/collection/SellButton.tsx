"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

const PLATFORMS = ["メルカリ", "ヤフオク", "カードショップ", "トレード", "その他"];

export default function SellButton({
  collectionId,
  cardId,
  grade,
  maxQuantity,
  acquiredPrice,
}: {
  collectionId: string;
  cardId: string;
  grade: string;
  maxQuantity: number;
  acquiredPrice: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [platform, setPlatform] = useState("メルカリ");
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const salePrice = parseInt(price, 10);
  const profit =
    !isNaN(salePrice) && acquiredPrice != null
      ? (salePrice - acquiredPrice) * qty
      : null;

  async function handleSubmit() {
    if (!price || isNaN(salePrice) || salePrice < 0) {
      setError("売却単価を入力してください");
      return;
    }
    setBusy(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }

    const { error: insertErr } = await supabase.from("user_sales").insert({
      user_id: user.id,
      card_id: cardId,
      grade,
      quantity_sold: qty,
      sale_price_per_card: salePrice,
      acquired_price: acquiredPrice,
      platform,
      sold_at: soldAt,
    });
    if (insertErr) { setError("記録に失敗しました"); setBusy(false); return; }

    if (qty >= maxQuantity) {
      await supabase.from("user_collections").delete().eq("id", collectionId);
    } else {
      await supabase
        .from("user_collections")
        .update({ quantity: maxQuantity - qty })
        .eq("id", collectionId);
    }

    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 border border-orange-300 rounded hover:bg-orange-50 text-orange-700 shrink-0"
      >
        売却
      </button>
    );
  }

  return (
    <div className="w-full mt-2 p-3 border border-orange-200 bg-orange-50 rounded-lg text-xs space-y-2">
      <div className="font-semibold text-orange-900">売却を記録</div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-600 w-20">枚数</span>
        <input
          type="number"
          min={1}
          max={maxQuantity}
          value={qty}
          onChange={(e) =>
            setQty(Math.min(maxQuantity, Math.max(1, parseInt(e.target.value) || 1)))
          }
          className="w-16 border rounded px-2 py-1 text-center bg-white"
        />
        <span className="text-gray-400">/ {maxQuantity}枚</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-600 w-20">売却単価</span>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">¥</span>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="5000"
            className="w-28 border rounded px-2 py-1 bg-white"
          />
        </div>
        {profit != null && (
          <span className={`font-semibold tabular-nums ${profit >= 0 ? "text-green-700" : "text-red-700"}`}>
            {profit >= 0 ? "+" : ""}¥{profit.toLocaleString()} 損益
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-600 w-20">プラットフォーム</span>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="border rounded px-2 py-1 bg-white"
        >
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-600 w-20">売却日</span>
        <input
          type="date"
          value={soldAt}
          onChange={(e) => setSoldAt(e.target.value)}
          className="border rounded px-2 py-1 bg-white"
        />
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded disabled:opacity-50"
        >
          {busy ? "記録中..." : "売却を記録"}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          className="px-3 py-1 border rounded text-gray-600 hover:bg-gray-50"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
