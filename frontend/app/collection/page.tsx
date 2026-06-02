import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { sbGet } from "../../lib/supabase";
import {
  attachLatestPrices,
  type CardSummary,
  type CardSummaryWithPrice,
} from "../../lib/api";
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
  grade: string;
  condition_note: string | null;
  acquired_price: number | null;
  added_at: string;
};

const GRADE_LABEL: Record<string, string> = {
  unspecified: "未指定",
  raw: "Raw",
  psa10: "PSA 10",
  psa9: "PSA 9",
  psa8: "PSA 8",
  psa7: "PSA 7",
  bgs10: "BGS 10",
  bgs9_5: "BGS 9.5",
  bgs9: "BGS 9",
  bgs8_5: "BGS 8.5",
  ars10: "ARS 10",
  ars9: "ARS 9",
  sgc10: "SGC 10",
  sgc9_5: "SGC 9.5",
  sgc9: "SGC 9",
};

const GRADE_BG: Record<string, string> = {
  psa10: "bg-amber-200 text-amber-900",
  psa9: "bg-yellow-100 text-yellow-900",
  psa8: "bg-yellow-50 text-yellow-800",
  bgs10: "bg-purple-200 text-purple-900",
  bgs9_5: "bg-purple-100 text-purple-900",
  raw: "bg-gray-100 text-gray-700",
  unspecified: "bg-gray-50 text-gray-500",
};

const BRAND_LABEL: Record<string, string> = {
  onepiece: "ワンピカード",
  pokemon: "ポケカ",
};

const BRAND_COLOR: Record<string, string> = {
  onepiece: "bg-orange-400",
  pokemon: "bg-yellow-400",
};

export default async function CollectionPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/");
  }

  const { data: rows } = await supabase
    .from("user_collections")
    .select("id,card_id,quantity,grade,condition_note,acquired_price,added_at")
    .order("added_at", { ascending: false });

  const collectionRows: CollectionRow[] = rows ?? [];

  const cardIds = Array.from(new Set(collectionRows.map((r) => r.card_id)));
  let cardMap = new Map<string, CardSummaryWithPrice>();
  const gradePriceMap = new Map<string, number>();
  if (cardIds.length > 0) {
    try {
      const baseCards = await sbGet<CardSummary[]>(
        "cards",
        `select=id,brand,set_code,card_no,variant,rarity,name_ja,image_url&id=in.(${cardIds.join(",")})`,
      );
      const withPrice = await attachLatestPrices(baseCards);
      cardMap = new Map(withPrice.map((c) => [c.id, c]));
      const gradeRows = await sbGet<
        { card_id: string; grade: string; price_median: number | null }[]
      >(
        "card_grade_prices_latest",
        `card_id=in.(${cardIds.join(",")})&select=card_id,grade,price_median`,
      );
      for (const r of gradeRows) {
        if (r.price_median != null) {
          gradePriceMap.set(`${r.card_id}:${r.grade}`, r.price_median);
        }
      }
    } catch {
      cardMap = new Map();
    }
  }

  function priceForGrade(cardId: string, grade: string, fallbackSell: number | null): number | null {
    if (grade === "unspecified") return fallbackSell;
    if (grade === "raw") {
      const g = gradePriceMap.get(`${cardId}:raw`);
      return g ?? fallbackSell;
    }
    return gradePriceMap.get(`${cardId}:${grade}`) ?? fallbackSell;
  }

  // 集計
  let totalSell = 0;
  let totalAcquired = 0;
  let totalQuantity = 0;
  let valuedQuantity = 0;

  const brandBreakdown = new Map<string, { qty: number; value: number }>();
  const gradeBreakdown = new Map<string, { qty: number; value: number }>();

  for (const r of collectionRows) {
    const c = cardMap.get(r.card_id);
    if (!c) continue;
    totalQuantity += r.quantity;
    const p = priceForGrade(r.card_id, r.grade, c.sell_price);
    const rowValue = p != null ? p * r.quantity : 0;
    if (p != null) {
      totalSell += rowValue;
      valuedQuantity += r.quantity;
    }
    if (r.acquired_price != null) totalAcquired += r.acquired_price * r.quantity;

    // ブランド別
    const bc = brandBreakdown.get(c.brand) ?? { qty: 0, value: 0 };
    brandBreakdown.set(c.brand, { qty: bc.qty + r.quantity, value: bc.value + rowValue });

    // グレード別
    const gc = gradeBreakdown.get(r.grade) ?? { qty: 0, value: 0 };
    gradeBreakdown.set(r.grade, { qty: gc.qty + r.quantity, value: gc.value + rowValue });
  }

  const unrealized = totalAcquired > 0 ? totalSell - totalAcquired : null;

  const brandItems = Array.from(brandBreakdown.entries())
    .sort((a, b) => b[1].value - a[1].value);
  const gradeItems = Array.from(gradeBreakdown.entries())
    .filter(([, v]) => v.qty > 0)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 6);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">📚 マイコレクション</h1>
        <p className="text-xs text-gray-500">
          保有カードの資産評価額。価格は直近1週間の販売中央値ベース。
        </p>
      </header>

      {/* ヒーロー: 評価額 + 含み損益 */}
      <section className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl p-5">
          <div className="text-sm text-blue-200 mb-1">コレクション評価額</div>
          <div className="text-4xl font-extrabold tabular-nums tracking-tight">
            {totalSell > 0 ? `¥${totalSell.toLocaleString()}` : "¥-"}
          </div>
          <div className="text-sm text-blue-200 mt-2 flex gap-3">
            <span>{collectionRows.length}種</span>
            <span>{totalQuantity}枚</span>
            {valuedQuantity < totalQuantity && (
              <span className="opacity-70">({valuedQuantity}枚分の価格あり)</span>
            )}
          </div>
        </div>
        <div
          className={`rounded-xl p-5 border-2 ${
            unrealized != null && unrealized >= 0
              ? "bg-green-50 border-green-200"
              : unrealized != null
                ? "bg-red-50 border-red-200"
                : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="text-sm text-gray-500 mb-1">含み損益</div>
          {unrealized != null ? (
            <>
              <div
                className={`text-4xl font-extrabold tabular-nums tracking-tight ${
                  unrealized >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {unrealized >= 0 ? "+" : "-"}¥{Math.abs(unrealized).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                取得額合計 ¥{totalAcquired.toLocaleString()}
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-gray-400 mt-1">-</div>
              <div className="text-xs text-gray-400 mt-2">
                カード詳細ページの「取得価格」を入力すると表示されます
              </div>
            </>
          )}
        </div>
      </section>

      {/* ブランド別 / グレード別内訳 */}
      {collectionRows.length > 0 && (
        <section className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {brandItems.length > 1 && (
            <div className="bg-white border rounded-xl p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-3">ブランド別内訳</h2>
              <div className="space-y-3">
                {brandItems.map(([brand, { qty, value }]) => {
                  const pct = totalSell > 0 ? Math.round((value / totalSell) * 100) : 0;
                  const label = BRAND_LABEL[brand] ?? brand;
                  const barColor = BRAND_COLOR[brand] ?? "bg-gray-400";
                  return (
                    <div key={brand}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{label}</span>
                        <span className="text-gray-500 tabular-nums">
                          ¥{value.toLocaleString()} · {qty}枚 · {pct}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {gradeItems.length > 0 && (
            <div className="bg-white border rounded-xl p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-3">グレード別内訳</h2>
              <div className="space-y-3">
                {gradeItems.map(([grade, { qty, value }]) => {
                  const pct = totalSell > 0 ? Math.round((value / totalSell) * 100) : 0;
                  const label = GRADE_LABEL[grade] ?? grade;
                  const isGraded = !["raw", "unspecified"].includes(grade);
                  return (
                    <div key={grade}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{label}</span>
                        <span className="text-gray-500 tabular-nums">
                          ¥{value.toLocaleString()} · {qty}枚
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isGraded ? "bg-amber-400" : "bg-blue-300"} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

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
            const unitPrice = c
              ? priceForGrade(r.card_id, r.grade, c.sell_price)
              : null;
            const acquiredTotal = r.acquired_price ? r.acquired_price * r.quantity : null;
            const sellTotal = unitPrice != null ? unitPrice * r.quantity : null;
            const diff =
              acquiredTotal != null && sellTotal != null
                ? sellTotal - acquiredTotal
                : null;
            const gradeLabel = GRADE_LABEL[r.grade] ?? r.grade;
            const gradeBg = GRADE_BG[r.grade] ?? "bg-gray-50 text-gray-600";
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
                  <div className="text-xs text-gray-500 mt-0.5 flex gap-2 flex-wrap items-center">
                    <span className="font-mono">{code}</span>
                    {c?.rarity && (
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-700">
                        {c.rarity}
                      </span>
                    )}
                    {c?.variant && c.variant !== "normal" && (
                      <span className="px-1.5 py-0.5 bg-purple-100 rounded text-[10px] text-purple-700">
                        {c.variant}
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${gradeBg}`}>
                      {gradeLabel}
                    </span>
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
