import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { sbGet } from "../../lib/supabase";
import {
  attachLatestPrices,
  type CardSummary,
  type CardSummaryWithPrice,
} from "../../lib/api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "価格ウォッチリスト",
  robots: { index: false, follow: false },
  description: "あなたが価格監視中のカード。指定価格を下回ったらバッジ表示。",
};

type WatchRow = {
  id: string;
  card_id: string;
  alert_below: number | null;
  note: string | null;
  created_at: string;
};

export default async function WatchlistPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/");
  }

  const { data: rows } = await supabase
    .from("user_watchlist")
    .select("id,card_id,alert_below,note,created_at")
    .order("created_at", { ascending: false });
  const watchRows: WatchRow[] = rows ?? [];

  const cardIds = Array.from(new Set(watchRows.map((r) => r.card_id)));
  let cardMap = new Map<string, CardSummaryWithPrice>();
  if (cardIds.length > 0) {
    try {
      const baseCards = await sbGet<CardSummary[]>(
        "cards",
        `select=id,brand,set_code,card_no,variant,rarity,name_ja,image_url&id=in.(${cardIds.join(",")})`,
      );
      const withPrice = await attachLatestPrices(baseCards);
      cardMap = new Map(withPrice.map((c) => [c.id, c]));
    } catch {
      cardMap = new Map();
    }
  }

  // alert triggered: current sell_price <= alert_below
  const triggered = watchRows.filter((r) => {
    const c = cardMap.get(r.card_id);
    return (
      r.alert_below != null && c?.sell_price != null && c.sell_price <= r.alert_below
    );
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">⭐ 価格ウォッチリスト</h1>
        <p className="text-xs text-gray-500">
          価格が指定ライン以下になったカードを上部にハイライト。
          現状は表示のみ (メール通知は順次対応予定)。
        </p>
      </header>

      {triggered.length > 0 && (
        <section className="mb-6 p-3 rounded-lg border-2 border-red-300 bg-red-50">
          <div className="text-sm font-bold text-red-900 mb-2">
            🔔 {triggered.length}件のカードが通知ラインを下回ってます
          </div>
          <ul className="space-y-1 text-xs">
            {triggered.map((r) => {
              const c = cardMap.get(r.card_id);
              if (!c) return null;
              const code = `${c.set_code}-${c.card_no}`;
              return (
                <li key={r.id} className="flex justify-between">
                  <Link
                    href={`/cards/${code}`}
                    className="text-red-800 hover:underline"
                  >
                    {c.name_ja} ({code})
                  </Link>
                  <span className="text-red-900 font-bold tabular-nums">
                    現価 ¥{c.sell_price?.toLocaleString()} ≤ 通知 ¥{r.alert_below?.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {watchRows.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded p-8 text-center">
          <p className="text-gray-600 mb-3">まだウォッチリストは空です</p>
          <p className="text-sm text-gray-500 mb-4">
            カード詳細ページの「⭐ ウォッチに追加」から登録できます。
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
          {watchRows.map((r) => {
            const c = cardMap.get(r.card_id);
            const code = c ? `${c.set_code}-${c.card_no}` : "削除済";
            const triggered =
              r.alert_below != null && c?.sell_price != null && c.sell_price <= r.alert_below;
            const diff =
              r.alert_below != null && c?.sell_price != null
                ? c.sell_price - r.alert_below
                : null;
            return (
              <li
                key={r.id}
                className={`p-3 flex items-center gap-3 ${triggered ? "bg-red-50" : ""}`}
              >
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
                  <div className="text-xs text-gray-500 mt-0.5 flex gap-2 flex-wrap items-center">
                    <span className="font-mono">{code}</span>
                    {c?.rarity && (
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-700">
                        {c.rarity}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs shrink-0">
                  <div className="font-semibold text-sm text-gray-900 tabular-nums">
                    現価 {c?.sell_price != null ? `¥${c.sell_price.toLocaleString()}` : "-"}
                  </div>
                  {r.alert_below != null && (
                    <div
                      className={`text-[11px] tabular-nums ${triggered ? "text-red-700 font-bold" : "text-gray-500"}`}
                    >
                      通知 ¥{r.alert_below.toLocaleString()}
                      {diff != null && !triggered && (
                        <span className="ml-1 text-gray-400">
                          (あと ¥{diff.toLocaleString()})
                        </span>
                      )}
                      {triggered && <span className="ml-1">🔔 達成</span>}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
