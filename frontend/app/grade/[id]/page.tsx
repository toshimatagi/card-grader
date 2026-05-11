import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getGrade,
  getCardByCode,
  listGradePrices,
  GRADE_LABEL,
  GRADE_DISPLAY_ORDER,
  type CardGradePrice,
  type CardGrade,
} from "../../../lib/api";
import GradeResultView from "../../../components/result/GradeResultView";
import GradeCardLinker from "../../../components/result/GradeCardLinker";
import AffiliateBlock from "../../../components/affiliate/AffiliateBlock";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let g;
  try {
    g = await getGrade(id);
  } catch {
    return { title: "鑑定結果が見つかりません" };
  }

  const grade = g.overall_grade.toFixed(1);
  const conf = Math.round(g.confidence * 100);
  const title = `鑑定結果: 総合 ${grade} / 10.0 (信頼度 ${conf}%)`;
  const description =
    `センタリング ${g.sub_grades.centering.score} / 表面 ${g.sub_grades.surface.score} / ` +
    `色印刷 ${g.sub_grades.color_print.score} / エッジ ${g.sub_grades.edges_corners.score}。` +
    "TCG Authority の自動鑑定結果。";

  const url = `${SITE_URL}/grade/${id}`;
  // OG 画像は app/grade/[id]/opengraph-image.tsx で動的生成
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      // 個別鑑定結果は検索インデックスから除外、ただしリンク追跡は許可 (シェア時の評価のため)
      index: false,
      follow: true,
    },
  };
}

export default async function GradePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ card?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  let g;
  try {
    g = await getGrade(id);
  } catch {
    notFound();
  }
  if (!g) notFound();

  // ?card= が指定されていればそのカードのグレード別相場を取得
  const cardCode = sp.card?.trim().toUpperCase() ?? null;
  let linkedCard: {
    code: string;
    name_ja: string;
    image_url: string | null;
    set_code: string;
    card_no: string;
    brand: string;
  } | null = null;
  let linkedGradePrices: CardGradePrice[] = [];

  if (cardCode && /^[A-Z]+\d+[A-Z]?-\d{1,3}$/.test(cardCode)) {
    try {
      const data = await getCardByCode(cardCode);
      if (data && data.cards.length > 0) {
        const c0 = data.cards[0];
        linkedCard = {
          code: data.code,
          name_ja: c0.name_ja,
          image_url: c0.image_url,
          set_code: c0.set_code,
          card_no: c0.card_no,
          brand: c0.brand,
        };
        linkedGradePrices = await listGradePrices(
          data.cards.map((c) => c.id),
        ).catch(() => [] as CardGradePrice[]);
      }
    } catch {
      // not found, ignore — UI will offer search again
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <nav className="text-sm text-gray-500 mb-4">
        <a href="/" className="hover:underline">トップ</a>
        <span className="mx-2">/</span>
        <span>鑑定結果</span>
      </nav>
      <GradeResultView result={g} shareUrl={`${SITE_URL}/grade/${id}`} />

      {/* 推定グレード → 相場参照への動線 */}
      <EstimatedGradeAndPrice
        overallGrade={g.overall_grade}
        confidence={g.confidence}
        linkedCard={linkedCard}
        linkedGradePrices={linkedGradePrices}
        cardCode={cardCode}
      />

      {/* アフィリエイト: 買取 CTA (高グレード時) + Amazon サプライ商品 */}
      <AffiliateBlock overallGrade={g.overall_grade} />

      <div className="mt-8 text-center">
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          自分のカードも鑑定してみる
        </a>
      </div>
    </div>
  );
}

/**
 * 鑑定スコアから PSA / BGS の推定グレードを示し、価格DBへの動線を提供する。
 * `linkedCard` が渡された場合、そのカードの実際の Raw/PSA10/PSA9 相場と
 * 推定グレード帯のハイライトを表示する。
 */
function EstimatedGradeAndPrice({
  overallGrade,
  confidence,
  linkedCard,
  linkedGradePrices,
  cardCode,
}: {
  overallGrade: number;
  confidence: number;
  linkedCard: {
    code: string;
    name_ja: string;
    image_url: string | null;
    set_code: string;
    card_no: string;
    brand: string;
  } | null;
  linkedGradePrices: CardGradePrice[];
  cardCode: string | null;
}) {
  // overall_grade から PSA 等価グレードを推定
  let estimatedGrade: CardGrade = "raw";
  let estimatedLabel = "Raw (未鑑定相当)";
  let bgClass = "bg-gray-50 border-gray-200";
  let textClass = "text-gray-800";

  if (overallGrade >= 9.5) {
    estimatedGrade = "psa10";
    estimatedLabel = "PSA10 相当 (Gem Mint)";
    bgClass = "bg-amber-50 border-amber-300";
    textClass = "text-amber-900";
  } else if (overallGrade >= 8.5) {
    estimatedGrade = "psa9";
    estimatedLabel = "PSA9 相当 (Mint)";
    bgClass = "bg-blue-50 border-blue-200";
    textClass = "text-blue-900";
  } else if (overallGrade >= 7.5) {
    estimatedGrade = "psa8";
    estimatedLabel = "PSA8 相当 (NM-MT)";
    bgClass = "bg-emerald-50 border-emerald-200";
    textClass = "text-emerald-900";
  }

  const lowConfidence = confidence < 0.7;

  // variant 横断で grade 別の最も sample 数の多い行を採用
  const gradeAggregated: Record<string, CardGradePrice> = {};
  for (const gp of linkedGradePrices) {
    const cur = gradeAggregated[gp.grade];
    if (!cur || (gp.sample_count ?? 0) > (cur.sample_count ?? 0)) {
      gradeAggregated[gp.grade] = gp;
    }
  }
  const availableGrades = GRADE_DISPLAY_ORDER.filter(
    (g) => gradeAggregated[g] != null,
  );

  const estimatedPrice = gradeAggregated[estimatedGrade]?.price_median;

  return (
    <section className={`mt-8 rounded-lg border-2 ${bgClass} p-5`}>
      <h2 className={`text-lg font-bold mb-3 ${textClass}`}>
        🏆 推定 PSA グレード &amp; 相場参照
      </h2>
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <div className={`text-2xl font-extrabold ${textClass}`}>
          {estimatedLabel}
        </div>
        {lowConfidence && (
          <span className="text-xs text-gray-600">
            (信頼度 {Math.round(confidence * 100)}% — 参考値)
          </span>
        )}
      </div>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        AI鑑定の総合スコア{" "}
        <strong>{overallGrade.toFixed(1)} / 10.0</strong>{" "}
        から、おおよその PSA 等価グレードを推定しています。実際の鑑定機関 (PSA / BGS)
        の判定とは一致しないことがあります。
      </p>

      {/* カード型番入力フォーム */}
      <div className="bg-white rounded p-3 border border-gray-200 mb-4">
        <div className="text-sm font-semibold mb-2 text-gray-800">
          🎴 鑑定したカードの型番を入力すると、推定買取額が表示されます
        </div>
        <GradeCardLinker initialCode={cardCode ?? undefined} />
      </div>

      {/* リンクされたカードの推定相場表示 */}
      {linkedCard && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="flex gap-3 items-start mb-3">
            {linkedCard.image_url && (
              <img
                src={linkedCard.image_url}
                alt={linkedCard.name_ja}
                className="w-16 h-auto rounded border flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 mb-0.5">
                対象カード
              </div>
              <Link
                href={`/cards/${linkedCard.code}`}
                className="text-base font-bold text-blue-700 hover:underline block truncate"
              >
                {linkedCard.name_ja}
              </Link>
              <div className="text-xs text-gray-500 font-mono mt-0.5">
                {linkedCard.set_code}-{linkedCard.card_no}
                <span className="ml-2 text-gray-400">
                  {linkedCard.brand === "pokemon" ? "ポケカ" : "ワンピ"}
                </span>
              </div>
            </div>
          </div>

          {availableGrades.length === 0 ? (
            <div className="text-sm text-gray-600 border border-dashed rounded p-3">
              このカードのグレード別相場データはまだ収集中です。
            </div>
          ) : (
            <>
              <div className="text-xs font-bold mb-2 text-gray-700">
                状態別 推定相場
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableGrades.map((g) => {
                  const gp = gradeAggregated[g];
                  const isEstimated = g === estimatedGrade;
                  return (
                    <div
                      key={g}
                      className={`rounded p-2 ${
                        isEstimated
                          ? "bg-amber-100 border-2 border-amber-500 ring-2 ring-amber-200"
                          : "bg-gray-50 border border-gray-200"
                      }`}
                    >
                      <div className="text-[10px] font-bold text-gray-700">
                        {GRADE_LABEL[g as CardGrade]}
                        {isEstimated && (
                          <span className="ml-1 text-amber-700">★ 推定</span>
                        )}
                      </div>
                      <div
                        className={`text-base font-extrabold tabular-nums ${
                          isEstimated ? "text-amber-700" : "text-gray-900"
                        }`}
                      >
                        ¥{gp.price_median?.toLocaleString() ?? "-"}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {gp.sample_count}件
                      </div>
                    </div>
                  );
                })}
              </div>
              {estimatedPrice != null && (
                <div className="mt-3 p-3 rounded bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 text-sm">
                  <div className="font-bold text-amber-900">
                    💰 あなたのスコアでの推定価格
                  </div>
                  <div className="mt-1 text-xs text-amber-800">
                    AI鑑定スコア {overallGrade.toFixed(1)} →{" "}
                    {GRADE_LABEL[estimatedGrade]} 相当 →{" "}
                    <strong className="text-base text-amber-900">
                      約 ¥{estimatedPrice.toLocaleString()}
                    </strong>
                    {gradeAggregated.raw &&
                      gradeAggregated.raw.price_median &&
                      estimatedGrade !== "raw" && (
                        <>
                          {" "}(Raw ¥
                          {gradeAggregated.raw.price_median.toLocaleString()}
                          {" "}との差額 +¥
                          {(
                            estimatedPrice -
                            gradeAggregated.raw.price_median
                          ).toLocaleString()}
                          )
                        </>
                      )}
                  </div>
                  <p className="mt-2 text-[10px] text-amber-800 leading-relaxed">
                    ※ 推定値です。実際の鑑定機関の判定や落札価格を保証するものではありません。
                  </p>
                </div>
              )}
            </>
          )}

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link
              href={`/cards/${linkedCard.code}`}
              className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              カード詳細・価格推移を見る →
            </Link>
          </div>
        </div>
      )}

      {/* 相場確認できなかった場合の代替動線 */}
      {!linkedCard && (
        <div className="bg-white rounded p-3 border border-gray-200 text-sm">
          <div className="font-semibold mb-2 text-gray-800">
            または価格DBから探す:
          </div>
          <ol className="list-decimal list-inside space-y-1 text-gray-700">
            <li>
              <a href="/cards" className="text-blue-700 hover:underline">
                価格DB
              </a>
              でカード型番を検索
            </li>
            <li>
              個別カードページの「状態別 推定相場」で{" "}
              <strong>{estimatedLabel}</strong> の中央値を確認
            </li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/cards"
              className="inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              価格DBで型番検索 →
            </a>
            <a
              href="/trending/psa10"
              className="inline-block px-4 py-2 text-sm border border-amber-300 bg-white rounded hover:bg-amber-50 text-amber-900"
            >
              PSA10 高額TOP
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
