import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getCardByCode,
  listRelatedCards,
  listGradePrices,
  GRADE_LABEL,
  GRADE_DISPLAY_ORDER,
  type CardVariant,
  type CardSummary,
  type CardGradePrice,
  type CardGrade,
  type PriceStats,
  type PriceConfidence,
} from "../../../lib/api";
import PriceChart from "../../../components/cards/PriceChart";
import ShareButtons from "../../../components/share/ShareButtons";
import AddToCollection from "../../../components/collection/AddToCollection";
import Psa10Simulator from "../../../components/psa/Psa10Simulator";
import AddToWatchlist from "../../../components/collection/AddToWatchlist";
import { getPokemonSetMeta } from "../../../lib/pokemonSets";
import { getOnePieceSetMeta } from "../../../lib/onepieceSets";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

type BrandMeta = {
  name_ja: string;       // 'ワンピースカード'
  name_short: string;    // 'ワンピカード'
  en: string;            // schema.org Product brand
  listPath: string;      // 価格DB一覧ページへのパス
  listLabel: string;     // 価格DBラベル
};

const BRAND_META: Record<string, BrandMeta> = {
  onepiece: {
    name_ja: "ワンピースカード",
    name_short: "ワンピカード",
    en: "ONE PIECE Card Game",
    listPath: "/cards/onepiece",
    listLabel: "ワンピカード価格DB",
  },
  pokemon: {
    name_ja: "ポケモンカード",
    name_short: "ポケカ",
    en: "Pokemon Trading Card Game",
    listPath: "/cards/pokemon",
    listLabel: "ポケカ価格DB",
  },
};

function getBrandMeta(brand: string | undefined): BrandMeta {
  return BRAND_META[brand ?? "onepiece"] ?? BRAND_META.onepiece;
}

type CollectionState = {
  authEnabled: boolean;
  loggedIn: boolean;
  // card_id → そのカード×grade ごとの保有エントリ一覧
  perCard: Record<string, { quantity: number; grade: string }[]>;
  // 同じカードのウォッチリスト entry (1人1card)
  watchByCard: Record<string, { alert_below: number | null; note: string | null }>;
};

async function getCollectionState(
  cardIds: string[],
): Promise<CollectionState> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { authEnabled: false, loggedIn: false, perCard: {}, watchByCard: {} };
  }
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { authEnabled: true, loggedIn: false, perCard: {}, watchByCard: {} };
    if (cardIds.length === 0) return { authEnabled: true, loggedIn: true, perCard: {}, watchByCard: {} };

    const [collectionsRes, watchRes] = await Promise.all([
      supabase
        .from("user_collections")
        .select("card_id,quantity,grade")
        .in("card_id", cardIds),
      supabase
        .from("user_watchlist")
        .select("card_id,alert_below,note")
        .in("card_id", cardIds),
    ]);

    const perCard: CollectionState["perCard"] = {};
    for (const row of collectionsRes.data ?? []) {
      const k = row.card_id as string;
      (perCard[k] ??= []).push({
        quantity: row.quantity as number,
        grade: row.grade as string,
      });
    }
    const watchByCard: CollectionState["watchByCard"] = {};
    for (const row of watchRes.data ?? []) {
      watchByCard[row.card_id as string] = {
        alert_below: row.alert_below as number | null,
        note: row.note as string | null,
      };
    }
    return { authEnabled: true, loggedIn: true, perCard, watchByCard };
  } catch {
    return { authEnabled: true, loggedIn: false, perCard: {}, watchByCard: {} };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  let data;
  try {
    data = await getCardByCode(code);
  } catch {
    return { title: `${code} - カードが見つかりません` };
  }
  if (!data || data.cards.length === 0) return { title: `${code} - カードが見つかりません` };

  const first = data.cards[0];
  const meta = getBrandMeta(first.brand);
  const codeUpper = data.code;
  const sellPrices = data.cards
    .map((c) => c.sell_price)
    .filter((p): p is number => p != null && p > 0);
  const buyPrices = data.cards
    .map((c) => c.buy_price)
    .filter((p): p is number => p != null && p > 0);
  const minSell = sellPrices.length ? Math.min(...sellPrices) : null;
  const maxSell = sellPrices.length ? Math.max(...sellPrices) : null;
  const maxBuy = buyPrices.length ? Math.max(...buyPrices) : null;
  const variantCount = data.cards.length;

  // 検索意図に合わせたキーワードリッチ title
  const sellRange =
    minSell != null && maxSell != null && minSell !== maxSell
      ? ` ¥${minSell.toLocaleString()}〜¥${maxSell.toLocaleString()}`
      : minSell != null
        ? ` ¥${minSell.toLocaleString()}`
        : "";
  const title = `${first.name_ja} ${codeUpper} 相場・買取価格${sellRange} | ${meta.name_short}`;

  // 動的 description: 販売中央値・買取最高値・バリアント数を含む
  const descParts: string[] = [];
  descParts.push(
    `${meta.name_ja}「${first.name_ja}」(${codeUpper}) の最新相場と買取価格`
  );
  if (variantCount > 1) {
    descParts.push(`${variantCount}バリアントを比較表示`);
  }
  if (minSell != null && maxSell != null && minSell !== maxSell) {
    descParts.push(`販売中央値 ¥${minSell.toLocaleString()}〜¥${maxSell.toLocaleString()}`);
  } else if (minSell != null) {
    descParts.push(`販売中央値 ¥${minSell.toLocaleString()}`);
  }
  if (maxBuy != null) {
    descParts.push(`買取最高値 ¥${maxBuy.toLocaleString()}`);
  }
  descParts.push("フリマ購入前・PSA提出前のチェックに");
  const description = descParts.join("。") + "。";

  const url = `${SITE_URL}/cards/${codeUpper}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      ...(first.image_url ? { images: [{ url: first.image_url, width: 480, height: 672, alt: first.name_ja }] } : {}),
    },
    twitter: {
      card: first.image_url ? "summary_large_image" : "summary",
      title,
      description,
      ...(first.image_url ? { images: [first.image_url] } : {}),
    },
  };
}

const VARIANT_LABEL: Record<string, string> = {
  normal: "通常",
  parallel: "パラレル",
  super_parallel: "スーパーパラレル",
  alt_art: "アルトアート",
  manga: "マンガ",
  other: "その他",
};

const VARIANT_COLOR: Record<string, string> = {
  normal: "#2563eb",
  parallel: "#dc2626",
  super_parallel: "#9333ea",
  alt_art: "#ea580c",
  manga: "#059669",
  other: "#6b7280",
};

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  let data;
  try {
    data = await getCardByCode(code);
  } catch {
    notFound();
  }

  if (!data || data.cards.length === 0) notFound();

  const sellSeries = buildSeries(data.cards, "sell");
  const buySeries = buildSeries(data.cards, "buy");
  const meta = getBrandMeta(data.cards[0]?.brand);

  const firstCard = data.cards[0];
  const [relatedCards, gradePrices, collectionState] = await Promise.all([
    listRelatedCards(firstCard.set_code, firstCard.card_no, 8).catch(
      () => [] as CardSummary[],
    ),
    listGradePrices(data.cards.map((c) => c.id)).catch(
      () => [] as CardGradePrice[],
    ),
    getCollectionState(data.cards.map((c) => c.id)),
  ]);

  // variant 横断で grade 別の最高サンプルを集約 (variant 毎にデータが薄いため)
  const gradeAggregated: Record<string, CardGradePrice> = {};
  for (const gp of gradePrices) {
    const cur = gradeAggregated[gp.grade];
    if (!cur || (gp.sample_count ?? 0) > (cur.sample_count ?? 0)) {
      gradeAggregated[gp.grade] = gp;
    }
  }
  const sortedGrades = GRADE_DISPLAY_ORDER.filter(
    (g) => gradeAggregated[g] != null,
  );

  const setMeta =
    firstCard.brand === "pokemon"
      ? getPokemonSetMeta(firstCard.set_code)
      : firstCard.brand === "onepiece"
        ? getOnePieceSetMeta(firstCard.set_code)
        : null;
  const setLandingPath =
    firstCard.brand === "pokemon"
      ? `/cards/pokemon/${firstCard.set_code}`
      : firstCard.brand === "onepiece"
        ? `/cards/onepiece/${firstCard.set_code}`
        : null;

  // JSON-LD 構造化データ (Product schema)
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${data.cards[0].name_ja} (${data.code})`,
    sku: data.code,
    image: data.cards.map((c) => c.image_url).filter(Boolean),
    brand: { "@type": "Brand", name: meta.en },
    offers: data.cards
      .filter((c) => c.sell_price != null)
      .map((c) => ({
        "@type": "Offer",
        priceCurrency: "JPY",
        price: c.sell_price,
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        name: `${VARIANT_LABEL[c.variant] ?? c.variant} ${c.rarity}`,
      })),
  };

  // BreadcrumbList JSON-LD (4階層: ホーム > 価格DB > {ブランド}DB > 個別カード)
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "ホーム",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "価格DB",
        item: `${SITE_URL}/cards`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: meta.listLabel,
        item: `${SITE_URL}${meta.listPath}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: `${data.cards[0].name_ja} (${data.code})`,
        item: `${SITE_URL}/cards/${data.code}`,
      },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/cards" className="hover:underline">価格DB</Link>
        <span className="mx-1.5">/</span>
        <Link href={meta.listPath} className="hover:underline">{meta.name_short}</Link>
        {setLandingPath && (
          <>
            <span className="mx-1.5">/</span>
            <Link href={setLandingPath} className="hover:underline">
              {firstCard.set_code}
              {setMeta && <span className="ml-1">{setMeta.name}</span>}
            </Link>
          </>
        )}
        <span className="mx-1.5">/</span>
        <span>{data.code}</span>
      </nav>

      <h1 className="text-2xl font-bold mb-2">
        {data.cards[0].name_ja}
        <span className="text-base text-gray-500 ml-3">{data.code}</span>
      </h1>
      <ShareButtons
        url={`${SITE_URL}/cards/${data.code}`}
        text={`${data.cards[0].name_ja} (${data.code}) の相場・PSA10価格`}
        className="mb-3"
        compact
      />
      {collectionState.authEnabled && data.cards.length === 1 && (
        <div className="mb-4">
          <AddToCollection
            cardId={firstCard.id}
            authEnabled={collectionState.authEnabled}
            loggedIn={collectionState.loggedIn}
            existing={(collectionState.perCard[firstCard.id] ?? []) as any}
            variantLabel={`${VARIANT_LABEL[firstCard.variant] ?? firstCard.variant} ${firstCard.rarity}`}
          />
        </div>
      )}
      {collectionState.authEnabled && data.cards.length > 1 && (
        <p className="text-xs text-gray-500 mb-4">
          📚 コレクションに追加するには下の「バリアント別 価格」表の各行から選択してください。
        </p>
      )}
      {collectionState.authEnabled && (
        <div className="mb-4">
          <AddToWatchlist
            cardId={firstCard.id}
            authEnabled={collectionState.authEnabled}
            loggedIn={collectionState.loggedIn}
            existing={collectionState.watchByCard[firstCard.id] ?? null}
            currentSellPrice={firstCard.sell_price ?? null}
          />
        </div>
      )}

      {/* 高額バリアント警告 (B-3) */}
      {(() => {
        const sellPrices = data.cards
          .map((c) => c.sell_price)
          .filter((p): p is number => p != null && p > 0);
        if (sellPrices.length < 2) return null;
        const minP = Math.min(...sellPrices);
        const maxP = Math.max(...sellPrices);
        const ratio = maxP / minP;
        if (ratio < 3) return null;
        const topVariant = data.cards.find((c) => c.sell_price === maxP);
        return (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
            ⚠️ <strong>高額バリアントあり</strong>: この型番には{" "}
            <strong>{ratio.toFixed(1)}倍</strong>の価格差があります (最安 ¥
            {minP.toLocaleString()} 〜 最高 ¥{maxP.toLocaleString()}
            {topVariant ? ` / ${VARIANT_LABEL[topVariant.variant] ?? topVariant.variant} ${topVariant.rarity}` : ""}
            )。フリマ購入時は<strong>イラスト・縁取り・レアリティ表記</strong>を必ず確認してください。
          </div>
        );
      })()}

      <div className="mb-8">
        <h2 className="font-bold mb-2">バリアント別 価格</h2>
        {(() => {
          const sellPrices = data.cards
            .map((c) => c.sell_price)
            .filter((p): p is number => p != null && p > 0);
          const minPrice = sellPrices.length ? Math.min(...sellPrices) : null;
          const HIGH_VALUE_VARIANTS = new Set(["parallel", "super_parallel", "alt_art"]);
          return (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2 border-b w-16">画像</th>
                  <th className="p-2 border-b">バリアント</th>
                  <th className="p-2 border-b">レアリティ</th>
                  <th className="p-2 border-b text-right">販売 (中央値)</th>
                  <th className="p-2 border-b text-right">倍率</th>
                  <th className="p-2 border-b text-right">販売レンジ</th>
                  <th className="p-2 border-b text-right">買取 (中央値)</th>
                  <th className="p-2 border-b text-right">買取率</th>
                  <th className="p-2 border-b">信頼度</th>
                  {collectionState.authEnabled && (
                    <th className="p-2 border-b">コレクション</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.cards.map((c) => {
                  const buyRate =
                    c.sell_stats && c.buy_stats && c.sell_stats.median > 0
                      ? Math.round((c.buy_stats.median / c.sell_stats.median) * 100)
                      : null;
                  const conf = c.sell_stats?.confidence ?? c.buy_stats?.confidence ?? null;
                  const multiplier =
                    c.sell_price != null && minPrice != null && minPrice > 0
                      ? c.sell_price / minPrice
                      : null;
                  const isHighValue =
                    HIGH_VALUE_VARIANTS.has(c.variant) ||
                    (multiplier != null && multiplier >= 3);
                  return (
                    <tr key={c.id} className="border-b align-top">
                      <td className="p-2">
                        {c.image_url ? (
                          <img
                            src={c.image_url}
                            alt={`${c.rarity} ${VARIANT_LABEL[c.variant] ?? c.variant}`}
                            className="w-12 h-auto rounded border"
                          />
                        ) : (
                          <div className="w-12 aspect-[5/7] bg-gray-100 rounded flex items-center justify-center text-[8px] text-gray-400">
                            No Img
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="inline-block w-3 h-3 rounded-full align-middle flex-shrink-0"
                            style={{ background: VARIANT_COLOR[c.variant] ?? "#999" }}
                          />
                          {VARIANT_LABEL[c.variant] ?? c.variant}
                          {isHighValue && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-medium whitespace-nowrap"
                              title="高額バリアント。通常版と混同しないよう注意"
                            >
                              ⚠️ 高額版
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2">{c.rarity}</td>
                      <td className="p-2 text-right tabular-nums">
                        {c.sell_price != null ? `¥${c.sell_price.toLocaleString()}` : "-"}
                      </td>
                      <td className="p-2 text-right tabular-nums text-xs">
                        {multiplier != null && multiplier >= 1.5 ? (
                          <span className={multiplier >= 3 ? "text-amber-700 font-bold" : "text-gray-700"}>
                            {multiplier.toFixed(1)}倍
                          </span>
                        ) : multiplier != null ? (
                          <span className="text-gray-400">基準</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-2 text-right text-xs text-gray-600 tabular-nums">
                        {c.sell_stats && c.sell_stats.min !== c.sell_stats.max
                          ? `¥${c.sell_stats.min.toLocaleString()}〜¥${c.sell_stats.max.toLocaleString()}`
                          : "-"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {c.buy_price != null ? `¥${c.buy_price.toLocaleString()}` : "-"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {buyRate != null ? `${buyRate}%` : "-"}
                      </td>
                      <td className="p-2">
                        {conf ? <ConfidenceBadge confidence={conf} /> : "-"}
                      </td>
                      {collectionState.authEnabled && (
                        <td className="p-2">
                          <AddToCollection
                            cardId={c.id}
                            variantLabel={`${VARIANT_LABEL[c.variant] ?? c.variant} ${c.rarity}`}
                            authEnabled={collectionState.authEnabled}
                            loggedIn={collectionState.loggedIn}
                            existing={(collectionState.perCard[c.id] ?? []) as any}
                            compact
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}

        {/* 集計サマリ (販売・買取それぞれデータがある最初のバリアント) */}
        {(() => {
          const sell = data.cards.find((c) => c.sell_stats)?.sell_stats;
          const buy = data.cards.find((c) => c.buy_stats)?.buy_stats;
          return (
            <>
              {sell && <PriceStatsSummary stats={sell} priceType="sell" />}
              {buy && <PriceStatsSummary stats={buy} priceType="buy" />}
            </>
          );
        })()}

        {/* 見分けポイント (B-3 汎用テンプレート) */}
        <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-900">
          <div className="font-semibold mb-1">🔍 バリアントの見分けポイント</div>
          <ul className="list-disc list-inside space-y-0.5 leading-snug">
            <li>レアリティ表記 (右下/左下の小さな文字 ・SR / SEC / P など) を確認</li>
            <li>イラスト・背景・縁取りの色・箔押し有無を見比べる</li>
            <li>パラレル/アルトアートはイラストや構図が通常版と異なることが多い</li>
            <li>フリマでは <strong>表面・裏面・型番周辺の拡大写真</strong> を依頼すると確実</li>
          </ul>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          ※ 複数の取扱いサイトから集計した中央値を表示しています
        </p>
      </div>

      {/* グレード別 推定相場 (PriceCharting 風) */}
      <section className="mb-8">
        <h2 className="font-bold mb-2">状態別 推定相場</h2>
        {sortedGrades.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded p-4 text-sm text-gray-500">
            <p className="mb-2">
              このカードのグレード別 (Raw / PSA10 / PSA9 等) の{" "}
              <strong>ネット取引履歴は見つかりません</strong>でした。
            </p>
            <p className="text-xs">
              コモン・アンコモン等は個別に PSA / BGS 提出されることがほぼ無く、
              ネット相場が立ちません。カードショップの<strong>ストレージ</strong>
              で見つけるのが現実的です。
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {sortedGrades.map((grade) => {
                const gp = gradeAggregated[grade as CardGrade];
                const updated = gp.captured_at
                  ? new Date(gp.captured_at).toISOString().slice(0, 10)
                  : "-";
                const isPSA10 = grade === "psa10";
                return (
                  <div
                    key={grade}
                    className={`rounded-lg border p-3 ${
                      isPSA10
                        ? "border-amber-400 bg-amber-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="text-xs font-bold mb-1 text-gray-700">
                      {GRADE_LABEL[grade as CardGrade]}
                    </div>
                    <div
                      className={`text-xl font-extrabold tabular-nums ${
                        isPSA10 ? "text-amber-700" : "text-gray-900"
                      }`}
                    >
                      {gp.price_median != null
                        ? `¥${gp.price_median.toLocaleString()}`
                        : "-"}
                    </div>
                    {gp.price_min != null && gp.price_max != null &&
                      gp.price_min !== gp.price_max && (
                        <div className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
                          ¥{gp.price_min.toLocaleString()}〜¥
                          {gp.price_max.toLocaleString()}
                        </div>
                      )}
                    <div className="text-[10px] text-gray-400 mt-1">
                      {gp.sample_count}件・{updated}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
              ※ 国内オークション・フリマ等の売却済みデータから集計した参考相場です。
              グレード別の販売価格は出品者によりばらつきがあるため、最終判断は実物確認と公式鑑定機関にお任せください。
              {gradeAggregated.psa10 && gradeAggregated.raw &&
                gradeAggregated.psa10.price_median != null &&
                gradeAggregated.raw.price_median != null && (
                  <>
                    {" "}PSA10 は Raw の約{" "}
                    <strong>
                      {(
                        gradeAggregated.psa10.price_median /
                        Math.max(gradeAggregated.raw.price_median, 1)
                      ).toFixed(1)}
                      倍
                    </strong>
                    で取引されています。
                  </>
                )}
            </p>
            {/* 鑑定への動線 */}
            <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <div className="text-sm text-blue-900 mb-1 font-semibold">
                💡 PSA提出を検討中の方へ
              </div>
              <p className="text-xs text-blue-900 leading-relaxed">
                提出前に表面・裏面の状態を AI 鑑定でチェックして、PSA10 / PSA9
                が狙えるかを事前判断できます。
              </p>
              <Link
                href="/"
                className="inline-block mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                AI鑑定で表裏チェック →
              </Link>
            </div>
          </>
        )}
      </section>

      {/* PSA10提出 損益シミュレーター (独自軸) */}
      <Psa10Simulator
        cardName={data.cards[0].name_ja}
        prices={{
          psa10: gradeAggregated.psa10?.price_median ?? null,
          psa9:  gradeAggregated.psa9?.price_median  ?? null,
          psa8:  gradeAggregated.psa8?.price_median  ?? null,
          raw:   gradeAggregated.raw?.price_median   ?? null,
        }}
      />

      <section className="mb-8">
        <h2 className="font-bold mb-2">販売価格の推移</h2>
        <PriceChart series={sellSeries} />
      </section>

      <section className="mb-8">
        <h2 className="font-bold mb-2">買取価格の推移</h2>
        <PriceChart series={buySeries} />
      </section>

      {/* SEO本文セクション (G-3 動的生成テンプレ) */}
      <CardDetailNotes
        cards={data.cards}
        cardCode={data.code}
        brandMeta={meta}
        setName={setMeta?.name ?? null}
        setReleaseDate={setMeta?.releaseDate ?? null}
        setKind={setMeta && "kind" in setMeta ? setMeta.kind : null}
      />

      {/* 関連カード — 同セット内の前後カード+ランダム数枚 (SEO 内部リンク) */}
      {relatedCards.length > 0 && (
        <section className="mt-8 border-t pt-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-bold">
              同じセット ({firstCard.set_code}{setMeta && ` ${setMeta.name}`}) の他カード
            </h2>
            {setLandingPath && (
              <Link
                href={setLandingPath}
                className="text-xs text-blue-700 hover:underline"
              >
                セット全カードを見る →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {relatedCards.map((c) => {
              const code = `${c.set_code}-${c.card_no}`;
              return (
                <Link
                  key={code}
                  href={`/cards/${code}`}
                  className="border rounded p-2 hover:shadow-sm transition-shadow flex flex-col text-center"
                >
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={`${c.name_ja} (${code})`}
                      className="w-full h-auto mb-1 rounded"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-[5/7] bg-gray-100 mb-1 rounded flex items-center justify-center text-[10px] text-gray-400">
                      No Img
                    </div>
                  )}
                  <div className="text-[10px] text-gray-500 font-mono">
                    {code}
                  </div>
                  <div className="text-[11px] leading-tight line-clamp-2">
                    {c.name_ja}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function CardDetailNotes({
  cards,
  cardCode,
  brandMeta,
  setName,
  setReleaseDate,
  setKind,
}: {
  cards: CardVariant[];
  cardCode: string;
  brandMeta: BrandMeta;
  setName: string | null;
  setReleaseDate: string | null;
  setKind: string | null;
}) {
  const sellPrices = cards
    .map((c) => c.sell_price)
    .filter((p): p is number => p != null && p > 0);
  const buyPrices = cards
    .map((c) => c.buy_price)
    .filter((p): p is number => p != null && p > 0);
  const minSell = sellPrices.length ? Math.min(...sellPrices) : null;
  const maxSell = sellPrices.length ? Math.max(...sellPrices) : null;
  const maxBuy = buyPrices.length ? Math.max(...buyPrices) : null;
  const ratio =
    minSell != null && maxSell != null && minSell > 0 ? maxSell / minSell : null;
  const variantCount = cards.length;
  const name = cards[0]?.name_ja ?? "";
  const rarities = Array.from(
    new Set(cards.map((c) => c.rarity).filter((r): r is string => !!r)),
  );
  const setCode = cards[0]?.set_code ?? "";
  const cardNo = cards[0]?.card_no ?? "";

  // 代表バリアント (販売データありの最初)
  const repStats = cards.find((c) => c.sell_stats)?.sell_stats;
  const buyStats = cards.find((c) => c.buy_stats)?.buy_stats;
  const buyRatePct =
    repStats && buyStats && repStats.median > 0
      ? Math.round((buyStats.median / repStats.median) * 100)
      : null;

  // 価格推移 (代表バリアントの直近2点で簡易判定)
  const repCard = cards.find((c) => c.history.some((h) => h.price_type === "sell"));
  const sellHist = repCard?.history.filter((h) => h.price_type === "sell") ?? [];
  let trendComment: string | null = null;
  if (sellHist.length >= 2) {
    const first = sellHist[0].price as number;
    const last = sellHist[sellHist.length - 1].price as number;
    if (first > 0) {
      const pct = ((last - first) / first) * 100;
      if (Math.abs(pct) >= 10) {
        trendComment = pct > 0
          ? `直近の販売中央値は約 ${pct.toFixed(1)}% 上昇傾向にあります。`
          : `直近の販売中央値は約 ${Math.abs(pct).toFixed(1)}% 下落傾向にあります。`;
      } else {
        trendComment = "直近の販売中央値は概ね横ばいで推移しています。";
      }
    }
  }

  return (
    <section className="space-y-4 mb-8">
      <h2 className="text-lg font-bold border-b pb-1">
        {name} ({cardCode}) の相場コメント
      </h2>

      {/* セット内コンテキスト (per-card unique text - 重複ペナルティ回避) */}
      {(setName || rarities.length > 0) && (
        <div className="p-4 rounded-lg border bg-white">
          <h3 className="font-semibold text-sm mb-2">📋 カード情報</h3>
          <p className="text-sm leading-relaxed text-gray-700">
            <strong>{name}</strong> ({cardCode}) は
            {setName && (
              <>
                {brandMeta.name_ja}
                {setKind && `「${setKind}」`}
                <strong>「{setName}」</strong> ({setCode}
                {setReleaseDate && `、${setReleaseDate}発売`}) 収録の
              </>
            )}
            {rarities.length > 0 && (
              <>
                <strong>
                  {rarities.length === 1
                    ? `${rarities[0]} レアリティ`
                    : `${rarities.join(" / ")} の${rarities.length}バリアント`}
                </strong>
              </>
            )}
            {!setName && "型番"}カード (型番: <span className="font-mono">{cardCode}</span>、
            セット内番号 <strong>{cardNo}</strong>) です。
            {variantCount > 1 && (
              <>
                {" "}本ページでは {variantCount} バリアントの販売・買取相場、
                90日推移、PSA10/PSA9/Raw のグレード別中央値を一覧できます。
              </>
            )}
          </p>
        </div>
      )}

      {/* 相場コメント */}
      <div className="p-4 rounded-lg border bg-white">
        <h3 className="font-semibold text-sm mb-2">📊 相場の概要</h3>
        <p className="text-sm leading-relaxed text-gray-700">
          {brandMeta.name_ja}「{name}」({cardCode}) は
          {variantCount > 1
            ? `${variantCount}バリアントが流通しており、`
            : "現在、"}
          {minSell != null && maxSell != null && minSell !== maxSell ? (
            <>
              販売中央値は <strong>¥{minSell.toLocaleString()}</strong> 〜 <strong>¥{maxSell.toLocaleString()}</strong>{" "}
              の幅があります。
              {ratio != null && ratio >= 3 && (
                <>
                  {" "}通常版と高額バリアントで <strong>約{ratio.toFixed(1)}倍</strong> の価格差があるため、
                  購入時はレアリティ・イラスト・縁取りを必ず確認してください。
                </>
              )}
            </>
          ) : minSell != null ? (
            <>
              販売中央値は <strong>¥{minSell.toLocaleString()}</strong> 前後で推移しています。
            </>
          ) : (
            <>
              ネット市場 (通販・オークション・フリマ) での
              <strong>取引履歴が見つかりませんでした</strong>。
              コモン・アンコモン等の低レアカードは個別出品されにくく、
              ネット相場が立ちにくい傾向があります。実カードを探す場合は
              <strong>カードショップのストレージ (在庫箱) でのセルフ検索</strong>を推奨します。
            </>
          )}
          {maxBuy != null && (
            <>
              {" "}買取最高値は <strong>¥{maxBuy.toLocaleString()}</strong>
              {buyRatePct != null && (
                <>
                  {" "}(販売価格の約 {buyRatePct}%)
                </>
              )}
              。
            </>
          )}
        </p>
      </div>

      {/* 価格推移コメント */}
      {trendComment && (
        <div className="p-4 rounded-lg border bg-white">
          <h3 className="font-semibold text-sm mb-2">📈 価格推移</h3>
          <p className="text-sm leading-relaxed text-gray-700">{trendComment}</p>
        </div>
      )}

      {/* 仕入れ時の注意点 */}
      <div className="p-4 rounded-lg border bg-white">
        <h3 className="font-semibold text-sm mb-2">💡 仕入れ・購入時の注意点</h3>
        <ul className="list-disc list-inside space-y-1 text-sm leading-relaxed text-gray-700">
          {ratio != null && ratio >= 3 && (
            <li>
              <strong>高額バリアント</strong>と通常版で大きな価格差があります。型番だけでなくイラスト・レアリティ表記・箔押し有無を確認しましょう。
            </li>
          )}
          {buyRatePct != null && buyRatePct < 50 && (
            <li>
              買取率が販売価格の約 <strong>{buyRatePct}%</strong> と低めです。短期転売の利幅は薄いので慎重に判断してください。
            </li>
          )}
          {buyRatePct != null && buyRatePct >= 60 && (
            <li>
              買取率は販売価格の約 <strong>{buyRatePct}%</strong> と比較的高く、需要のあるカードと考えられます。
            </li>
          )}
          {repStats && repStats.confidence !== "high" && (
            <li>
              現在の販売価格は{repStats.confidence === "low" ? "取得元が少なく" : "やや取得サイトが限られており"}
              、<strong>表示価格を過信せず</strong>複数サイトでの確認を推奨します。
            </li>
          )}
          <li>フリマで購入する場合は、表面・裏面・四隅・型番周辺の<strong>追加写真</strong>を依頼すると安心です。</li>
        </ul>
      </div>

      {/* PSA提出時の注意点 */}
      <div className="p-4 rounded-lg border bg-white">
        <h3 className="font-semibold text-sm mb-2">🏆 PSA/BGS 提出時の注意点</h3>
        <ul className="list-disc list-inside space-y-1 text-sm leading-relaxed text-gray-700">
          <li>裏面の<strong>白かけ・角欠け・エッジ傷</strong>は鑑定スコアに大きく影響します。提出前に表裏チェックを必ず行ってください。</li>
          <li>センタリングは表裏のうち<strong>悪い方</strong>が採用されるため、両面を確認することが重要です。</li>
          {ratio != null && ratio >= 3 && (
            <li>
              高額バリアントは PSA10 取得時のリターンが大きい一方、状態への要求も厳しくなります。状態が完璧でない場合は無鑑定で売却する選択も検討してください。
            </li>
          )}
          <li>
            鑑定費用・送料を踏まえた損益分岐点を確認してから提出を判断しましょう。
            <a href="/" className="text-blue-600 hover:underline ml-1">
              表裏チェックツール
            </a>
            でセンタリング目安を測定できます。
          </li>
        </ul>
      </div>

      <p className="text-[11px] text-gray-500">
        ※ 上記コメントは集計データから自動生成しており、最終判断はご自身でお願いします。AIによる正式鑑定ではありません。
      </p>
    </section>
  );
}

function buildSeries(cards: CardVariant[], priceType: "sell" | "buy") {
  return cards
    .map((c) => ({
      id: c.id,
      label: `${VARIANT_LABEL[c.variant] ?? c.variant} / ${c.rarity}`,
      color: VARIANT_COLOR[c.variant] ?? "#6b7280",
      points: c.history
        .filter((h) => h.price_type === priceType && h.price != null)
        .map((h) => ({ t: h.captured_at, v: h.price as number })),
    }))
    .filter((s) => s.points.length > 0);
}

function ConfidenceBadge({ confidence }: { confidence: PriceConfidence }) {
  const meta: Record<PriceConfidence, { label: string; cls: string }> = {
    high: { label: "高", cls: "bg-green-100 text-green-700 border-green-200" },
    medium: { label: "中", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    low: { label: "低", cls: "bg-gray-100 text-gray-600 border-gray-200" },
  };
  const m = meta[confidence];
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diffMin = Math.floor((Date.now() - t) / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}時間前`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}日前`;
}

function PriceStatsSummary({ stats, priceType }: { stats: PriceStats; priceType: "sell" | "buy" }) {
  const label = priceType === "sell" ? "販売" : "買取";
  const reason: string[] = [];
  if (stats.sourceCount < 2) reason.push("取得元1サイトのみ");
  if (stats.sampleCount < 5) reason.push(`データ${stats.sampleCount}件`);
  const spread = stats.median > 0 ? (stats.max - stats.min) / stats.median : 0;
  if (spread > 0.5) reason.push("価格ブレ大");
  return (
    <div className="mt-3 text-xs text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-medium">{label}価格 信頼度:</span>
      <ConfidenceBadge confidence={stats.confidence} />
      <span>取得元 {stats.sourceCount}サイト</span>
      <span>{stats.sampleCount}件</span>
      <span>最終更新 {relativeTime(stats.lastAt)}</span>
      {stats.min !== stats.max && (
        <span>
          幅 ¥{stats.min.toLocaleString()}〜¥{stats.max.toLocaleString()}
        </span>
      )}
      {reason.length > 0 && stats.confidence !== "high" && (
        <span className="text-amber-700">({reason.join(" / ")})</span>
      )}
    </div>
  );
}
