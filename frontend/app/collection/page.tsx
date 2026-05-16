import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { sbGet } from "../../lib/supabase";
import RemoveButtonClient from "../../components/collection/RemoveButtonClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "マイコレクション",
  robots: { index: false, follow: false },
  description: "あなたが保有しているカード一覧と資産評価額。",
};

type CollectionRow = {
  id: string;
  card_id: string;
  quantity: number;
  condition_note: string | null;
  acquired_price: number | null;
  added_at: string;
};

type CardRow = {
  id: string;
  set_code: string;
  card_no: string;
  name_ja: string;
  rarity: string | null;
  image_url: string | null;
  sell_price: number | null;
  buy_price: number | null;
  brand: string;
};

export default async function CollectionPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/");
  }

  // RLS により自分の行のみ返る
  const { data: rows } = await supabase
    .from("user_collections")
    .select("id,card_id,quantity,condition_note,acquired_price,added_at")
    .order("added_at", { ascending: false });

  const collectionRows: CollectionRow[] = rows ?? [];

  // card_id → card 詳細を一括取得 (SERVICE_KEY 経由 = price データ含む)
  const cardIds = collectionRows.map((r) => r.card_id);
  let cards: CardRow[] = [];
  if (cardIds.length > 0) {
    try {
      cards = await sbGet<CardRow[]>(
        "cards",
        `select=id,set_code,card_no,name_ja,rarity,image_url,sell_price,buy_price,brand&id=in.(${cardIds.join(",")})`,
      );
    } catch {
      cards = [];
    }
  }
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  // 集計
  let totalSell = 0;
  let totalAcquired = 0;
  let totalQuantity = 0;
  for (const r of collectionRows) {
    const c = cardMap.get(r.card_id);
    if (!c) continue;
    totalQuantity += r.quantity;
    if (c.sell_price) totalSell += c.sell_price * r.quantity;
    if (r.acquired_price) totalAcquired += r.acquired_price * r.quantity;
  }
  const unrealized = totalAcquired > 0 ? totalSell - totalAcquired : null;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">📚 マイコレクション</h1>
        <p className="text-xs text-gray-500">
          あなたが保有しているカードと資産評価額。価格は最新の販売中央値ベース。
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="登録カード" value={`${collectionRows.length}種`} />
        <Stat label="合計枚数" value={`${totalQuantity}枚`} />
        <Stat
          label="評価額 (販売中央値)"
          value={totalSell > 0 ? `¥${totalSell.toLocaleString()}` : "-"}
        />
        <Stat
          label="含み損益"
          value={
            unrealized != null
              ? `${unrealized >= 0 ? "+" : "-"}¥${Math.abs(unrealized).toLocaleString()}`
              : "-"
          }
          highlight={unrealized != null && unrealized >= 0 ? "good" : unrealized != null ? "bad" : undefined}
        />
      </section>

      {collectionRows.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded p-8 text-center">
          <p className="text-gray-600 mb-3">まだコレクションは空です</p>
          <p className="text-sm text-gray-500 mb-4">
            カード詳細ページの「📚 コレクションに追加」から登録できます。
          </p>
          <Link
            href="/cards"
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            価格DBを見る
          </Link>
        </div>
      ) : (
        <ul className="border rounded-lg divide-y bg-white">
          {collectionRows.map((r) => {
            const c = cardMap.get(r.card_id);
            const code = c ? `${c.set_code}-${c.card_no}` : "削除済";
            const acquiredTotal = r.acquired_price ? r.acquired_price * r.quantity : null;
            const sellTotal = c?.sell_price ? c.sell_price * r.quantity : null;
            const diff = acquiredTotal != null && sellTotal != null ? sellTotal - acquiredTotal : null;
            return (
              <li key={r.id} className="p-3 flex items-center gap-3">
                {c?.image_url ? (
                  <Link href={`/cards/${code}`} className="shrink-0">
                    <img
                      src={c.image_url}
                      alt={c.name_ja}
                      className="w-12 h-auto rounded"
                      loading="lazy"
                    />
                  </Link>
                ) : (
                  <div className="w-12 h-16 bg-gray-100 rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/cards/${code}`}
                    className="text-sm font-semibold text-gray-900 hover:text-blue-700 truncate block"
                  >
                    {c?.name_ja ?? "(カード情報なし)"}
                  </Link>
                  <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                    <span className="font-mono">{code}</span>
                    {c?.rarity && <span>{c.rarity}</span>}
                    <span>×{r.quantity}</span>
                  </div>
                  {r.condition_note && (
                    <div className="text-[11px] text-gray-600 mt-1">📝 {r.condition_note}</div>
                  )}
                </div>
                <div className="text-right text-xs shrink-0">
                  <div className="font-semibold text-sm text-gray-900">
                    {sellTotal != null ? `¥${sellTotal.toLocaleString()}` : "-"}
                  </div>
                  {diff != null && (
                    <div className={diff >= 0 ? "text-green-700" : "text-red-700"}>
                      {diff >= 0 ? "+" : "-"}¥{Math.abs(diff).toLocaleString()}
                    </div>
                  )}
                </div>
                <RemoveButtonClient id={r.id} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "good" | "bad";
}) {
  const cls =
    highlight === "good"
      ? "text-green-700"
      : highlight === "bad"
        ? "text-red-700"
        : "text-gray-900";
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${cls}`}>{value}</div>
    </div>
  );
}

