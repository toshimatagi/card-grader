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
import SellButton from "../../components/collection/SellButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "マイコレクション",
  robots: { index: false, follow: false },
  description: "あなたが保有しているカード一覧と資産評価額・売却管理。",
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

type SaleRow = {
  id: string;
  card_id: string | null;
  grade: string;
  quantity_sold: number;
  sale_price_per_card: number;
  acquired_price: number | null;
  platform: string | null;
  sold_at: string;
  note: string | null;
  created_at: string;
};

const GRADE_LABEL: Record<string, string> = {
  unspecified: "未指定",
  raw: "Raw",
  psa10: "PSA 10", psa9: "PSA 9", psa8: "PSA 8", psa7: "PSA 7",
  bgs10: "BGS 10", bgs9_5: "BGS 9.5", bgs9: "BGS 9", bgs8_5: "BGS 8.5",
  ars10: "ARS 10", ars9: "ARS 9",
  sgc10: "SGC 10", sgc9_5: "SGC 9.5", sgc9: "SGC 9",
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

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "sold" ? "sold" : "held";

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: colData }, { data: saleData }] = await Promise.all([
    supabase
      .from("user_collections")
      .select("id,card_id,quantity,grade,condition_note,acquired_price,added_at")
      .order("added_at", { ascending: false }),
    supabase
      .from("user_sales")
      .select("id,card_id,grade,quantity_sold,sale_price_per_card,acquired_price,platform,sold_at,note,created_at")
      .order("sold_at", { ascending: false }),
  ]);

  const collectionRows: CollectionRow[] = colData ?? [];
  const salesRows: SaleRow[] = saleData ?? [];

  const collectionCardIds = Array.from(new Set(collectionRows.map((r) => r.card_id)));
  // 売却済みカードのうちコレクションに含まれないIDのみ（名前・画像の表示用、価格取得不要）
  const collectionCardIdSet = new Set(collectionCardIds);
  const salesOnlyCardIds = Array.from(new Set(
    salesRows.map((r) => r.card_id).filter((id): id is string => id != null && !collectionCardIdSet.has(id))
  ));

  let cardMap = new Map<string, CardSummaryWithPrice>();
  const gradePriceMap = new Map<string, number>();

  // コレクションカード: 価格付きで取得（評価額・損益の計算に必要）
  if (collectionCardIds.length > 0) {
    try {
      const baseCards = await sbGet<CardSummary[]>(
        "cards",
        `select=id,brand,set_code,card_no,variant,rarity,name_ja,image_url&id=in.(${collectionCardIds.join(",")})`,
      );
      const withPrice = await attachLatestPrices(baseCards);
      for (const c of withPrice) cardMap.set(c.id, c);
      const gradeRows = await sbGet<{ card_id: string; grade: string; price_median: number | null }[]>(
        "card_grade_prices_latest",
        `card_id=in.(${collectionCardIds.join(",")})&select=card_id,grade,price_median`,
      );
      for (const r of gradeRows) {
        if (r.price_median != null) gradePriceMap.set(`${r.card_id}:${r.grade}`, r.price_median);
      }
    } catch {
      // cardMap は空のまま継続
    }
  }

  // 売却済み専用カード: 名前・画像の表示だけ必要（価格取得なし）
  if (salesOnlyCardIds.length > 0) {
    try {
      const salesCards = await sbGet<CardSummary[]>(
        "cards",
        `select=id,brand,set_code,card_no,variant,rarity,name_ja,image_url&id=in.(${salesOnlyCardIds.join(",")})`,
      );
      for (const c of salesCards) cardMap.set(c.id, { ...c, sell_price: null, buy_price: null });
    } catch {
      // 表示できなくても継続
    }
  }

  function priceForGrade(cardId: string, grade: string, fallbackSell: number | null): number | null {
    if (grade === "unspecified") return fallbackSell;
    if (grade === "raw") return gradePriceMap.get(`${cardId}:raw`) ?? fallbackSell;
    return gradePriceMap.get(`${cardId}:${grade}`) ?? fallbackSell;
  }

  // 保有中の集計
  let totalSell = 0, totalAcquired = 0, totalQuantity = 0, valuedQuantity = 0;
  const brandBreakdown = new Map<string, { qty: number; value: number }>();
  const gradeBreakdown = new Map<string, { qty: number; value: number }>();

  for (const r of collectionRows) {
    const c = cardMap.get(r.card_id);
    if (!c) continue;
    totalQuantity += r.quantity;
    const p = priceForGrade(r.card_id, r.grade, c.sell_price);
    const rowValue = p != null ? p * r.quantity : 0;
    if (p != null) { totalSell += rowValue; valuedQuantity += r.quantity; }
    if (r.acquired_price != null) totalAcquired += r.acquired_price * r.quantity;
    const bc = brandBreakdown.get(c.brand) ?? { qty: 0, value: 0 };
    brandBreakdown.set(c.brand, { qty: bc.qty + r.quantity, value: bc.value + rowValue });
    const gc = gradeBreakdown.get(r.grade) ?? { qty: 0, value: 0 };
    gradeBreakdown.set(r.grade, { qty: gc.qty + r.quantity, value: gc.value + rowValue });
  }
  const unrealized = totalAcquired > 0 ? totalSell - totalAcquired : null;

  // 売却済みの集計
  let totalSaleRevenue = 0, totalSaleProfit = 0, hasProfitData = false;
  for (const s of salesRows) {
    totalSaleRevenue += s.quantity_sold * s.sale_price_per_card;
    if (s.acquired_price != null) {
      totalSaleProfit += (s.sale_price_per_card - s.acquired_price) * s.quantity_sold;
      hasProfitData = true;
    }
  }

  const brandItems = Array.from(brandBreakdown.entries()).sort((a, b) => b[1].value - a[1].value);
  const gradeItems = Array.from(gradeBreakdown.entries())
    .filter(([, v]) => v.qty > 0)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 6);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">📚 マイコレクション</h1>
        <p className="text-xs text-gray-500">
          保有カードの資産評価額と売却管理。価格は直近1週間の販売中央値ベース。
        </p>
      </header>

      {/* ヒーロー: 評価額 + 含み損益 */}
      <section className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className={`rounded-xl p-5 border-2 ${
          unrealized != null && unrealized >= 0 ? "bg-green-50 border-green-200"
          : unrealized != null ? "bg-red-50 border-red-200"
          : "bg-gray-50 border-gray-200"
        }`}>
          <div className="text-sm text-gray-500 mb-1">含み損益</div>
          {unrealized != null ? (
            <>
              <div className={`text-4xl font-extrabold tabular-nums tracking-tight ${unrealized >= 0 ? "text-green-700" : "text-red-700"}`}>
                {unrealized >= 0 ? "+" : "-"}¥{Math.abs(unrealized).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-2">取得額合計 ¥{totalAcquired.toLocaleString()}</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-gray-400 mt-1">-</div>
              <div className="text-xs text-gray-400 mt-2">取得価格を入力すると表示されます</div>
            </>
          )}
        </div>
      </section>

      {/* 売却サマリー（売却記録がある場合のみ表示） */}
      {salesRows.length > 0 && (
        <section className="mb-4 grid grid-cols-2 gap-3">
          <div className="bg-white border rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">累計売却額</div>
            <div className="text-2xl font-bold tabular-nums text-gray-900">
              ¥{totalSaleRevenue.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 mt-1">{salesRows.length}件の売却</div>
          </div>
          <div className={`border rounded-xl p-4 ${hasProfitData ? (totalSaleProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200") : "bg-white"}`}>
            <div className="text-xs text-gray-500 mb-1">確定利益</div>
            {hasProfitData ? (
              <div className={`text-2xl font-bold tabular-nums ${totalSaleProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                {totalSaleProfit >= 0 ? "+" : "-"}¥{Math.abs(totalSaleProfit).toLocaleString()}
              </div>
            ) : (
              <div className="text-xl font-bold text-gray-400">-</div>
            )}
            {!hasProfitData && (
              <div className="text-xs text-gray-400 mt-1">取得価格入力で表示</div>
            )}
          </div>
        </section>
      )}

      {/* ブランド別 / グレード別内訳（保有中タブのみ） */}
      {activeTab === "held" && collectionRows.length > 0 && (
        <section className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {brandItems.length > 1 && (
            <div className="bg-white border rounded-xl p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-3">ブランド別内訳</h2>
              <div className="space-y-3">
                {brandItems.map(([brand, { qty, value }]) => {
                  const pct = totalSell > 0 ? Math.round((value / totalSell) * 100) : 0;
                  return (
                    <div key={brand}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{BRAND_LABEL[brand] ?? brand}</span>
                        <span className="text-gray-500 tabular-nums">¥{value.toLocaleString()} · {qty}枚 · {pct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${BRAND_COLOR[brand] ?? "bg-gray-400"}`} style={{ width: `${pct}%` }} />
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
                  const isGraded = !["raw", "unspecified"].includes(grade);
                  return (
                    <div key={grade}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{GRADE_LABEL[grade] ?? grade}</span>
                        <span className="text-gray-500 tabular-nums">¥{value.toLocaleString()} · {qty}枚</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${isGraded ? "bg-amber-400" : "bg-blue-300"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* タブ */}
      <div className="flex gap-0 mb-4 border-b">
        <Link
          href="/collection?tab=held"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "held"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          保有中 <span className="text-xs text-gray-400">({collectionRows.length}種)</span>
        </Link>
        <Link
          href="/collection?tab=sold"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "sold"
              ? "border-orange-500 text-orange-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          売却済み <span className="text-xs text-gray-400">({salesRows.length}件)</span>
        </Link>
      </div>

      {/* 保有中タブ */}
      {activeTab === "held" && (
        collectionRows.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded p-8 text-center">
            <p className="text-gray-600 mb-3">まだコレクションは空です</p>
            <p className="text-sm text-gray-500 mb-4">カード詳細ページの「📚 コレクションに追加」から登録できます。</p>
            <Link href="/cards" className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
              価格DBを見る
            </Link>
          </div>
        ) : (
          <ul className="border rounded-lg divide-y bg-white">
            {collectionRows.map((r) => {
              const c = cardMap.get(r.card_id);
              const code = c ? `${c.set_code}-${c.card_no}` : "削除済";
              const unitPrice = c ? priceForGrade(r.card_id, r.grade, c.sell_price) : null;
              const acquiredTotal = r.acquired_price ? r.acquired_price * r.quantity : null;
              const sellTotal = unitPrice != null ? unitPrice * r.quantity : null;
              const diff = acquiredTotal != null && sellTotal != null ? sellTotal - acquiredTotal : null;
              const gradeBg = GRADE_BG[r.grade] ?? "bg-gray-50 text-gray-600";
              return (
                <li key={r.id} className="p-3 flex flex-wrap items-start gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {c?.image_url ? (
                      <Link href={`/cards/${code}`} className="shrink-0">
                        <img src={c.image_url} alt={c.name_ja} className="w-12 h-auto rounded" loading="lazy" />
                      </Link>
                    ) : (
                      <div className="w-12 h-16 bg-gray-100 rounded shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <Link href={`/cards/${code}`} className="text-sm font-semibold text-gray-900 hover:text-blue-700 truncate block">
                        {c?.name_ja ?? "(カード情報なし)"}
                      </Link>
                      <div className="text-xs text-gray-500 mt-0.5 flex gap-2 flex-wrap items-center">
                        <span className="font-mono">{code}</span>
                        {c?.rarity && (
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-700">{c.rarity}</span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${gradeBg}`}>
                          {GRADE_LABEL[r.grade] ?? r.grade}
                        </span>
                        <span>×{r.quantity}枚</span>
                      </div>
                      {r.condition_note && (
                        <div className="text-[11px] text-gray-600 mt-1">📝 {r.condition_note}</div>
                      )}
                      <SellButton
                        collectionId={r.id}
                        cardId={r.card_id}
                        grade={r.grade}
                        maxQuantity={r.quantity}
                        acquiredPrice={r.acquired_price}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right text-xs">
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
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      {/* 売却済みタブ */}
      {activeTab === "sold" && (
        salesRows.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded p-8 text-center">
            <p className="text-gray-600 mb-2">売却記録はまだありません</p>
            <p className="text-sm text-gray-500">「保有中」タブのカードにある「売却」ボタンから記録できます。</p>
          </div>
        ) : (
          <ul className="border rounded-lg divide-y bg-white">
            {salesRows.map((s) => {
              const c = s.card_id ? cardMap.get(s.card_id) : null;
              const code = c ? `${c.set_code}-${c.card_no}` : null;
              const totalRevenue = s.quantity_sold * s.sale_price_per_card;
              const profit = s.acquired_price != null
                ? (s.sale_price_per_card - s.acquired_price) * s.quantity_sold
                : null;
              const gradeBg = GRADE_BG[s.grade] ?? "bg-gray-50 text-gray-600";
              return (
                <li key={s.id} className="p-3 flex items-start gap-3">
                  {c?.image_url ? (
                    <Link href={`/cards/${code}`} className="shrink-0">
                      <img src={c.image_url} alt={c.name_ja} className="w-12 h-auto rounded opacity-70" loading="lazy" />
                    </Link>
                  ) : (
                    <div className="w-12 h-16 bg-gray-100 rounded shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {c && code ? (
                      <Link href={`/cards/${code}`} className="text-sm font-semibold text-gray-900 hover:text-blue-700 truncate block">
                        {c.name_ja}
                      </Link>
                    ) : (
                      <div className="text-sm font-semibold text-gray-400">(カード情報なし)</div>
                    )}
                    <div className="text-xs text-gray-500 mt-0.5 flex gap-2 flex-wrap items-center">
                      {code && <span className="font-mono">{code}</span>}
                      {c?.rarity && (
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-700">{c.rarity}</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${gradeBg}`}>
                        {GRADE_LABEL[s.grade] ?? s.grade}
                      </span>
                      <span>×{s.quantity_sold}枚</span>
                      {s.platform && (
                        <span className="px-1.5 py-0.5 bg-blue-50 rounded text-[10px] text-blue-700">{s.platform}</span>
                      )}
                      <span className="text-gray-400">{s.sold_at}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <div className="font-semibold text-sm text-gray-900">
                      ¥{totalRevenue.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      @¥{s.sale_price_per_card.toLocaleString()}×{s.quantity_sold}
                    </div>
                    {profit != null && (
                      <div className={`font-semibold ${profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {profit >= 0 ? "+" : "-"}¥{Math.abs(profit).toLocaleString()}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
}
