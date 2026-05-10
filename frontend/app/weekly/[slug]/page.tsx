import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getTrending,
  listSpreadRanking,
  type TrendingCard,
  type SpreadRankingRow,
} from "../../../lib/api";
import {
  parseWeekSlug,
  formatWeekRange,
  recentWeekSlugs,
  currentWeekSlug,
  formatWeekSlug,
} from "../../../lib/weeks";

export const revalidate = 3600; // 1h ISR

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export async function generateStaticParams() {
  // 直近 12 週分は SSG (それ以前は notFound、未来週もアクセス時に動的生成可能)
  return recentWeekSlugs(12).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseWeekSlug(slug);
  if (!parsed) {
    return { title: `週次レポート ${slug} - 不正なURL` };
  }
  const range = formatWeekRange(parsed.year, parsed.week);
  const title = `${range} 週次 値上がりレポート — ワンピ・ポケカ`;
  const description = `${range} の週間値上がり TOP10 と PSA10 倍率上位カード。ワンピース・ポケモンカードの直近1週間でホットなカードを集計。`;
  return {
    title,
    description,
    keywords: [
      `${slug} 値上がり`,
      `${parsed.year}年 W${parsed.week} ポケカ`,
      `${parsed.year}年 W${parsed.week} ワンピカード`,
      "週次値上がりランキング",
      "今週の値上がり",
      "PSA10 トレンド",
    ],
    alternates: { canonical: `/weekly/${slug}` },
    openGraph: {
      title,
      description,
      url: `/weekly/${slug}`,
      type: "article",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function WeeklyReport({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parsed = parseWeekSlug(slug);
  if (!parsed) notFound();

  const range = formatWeekRange(parsed.year, parsed.week);
  const isCurrent = slug === currentWeekSlug();

  const [opTop, pkmTop, spread] = await Promise.all([
    getTrending({ brand: "onepiece", periodHours: 168, priceType: "sell", limit: 10 }).catch(
      () => [] as TrendingCard[],
    ),
    getTrending({ brand: "pokemon", periodHours: 168, priceType: "sell", limit: 10 }).catch(
      () => [] as TrendingCard[],
    ),
    listSpreadRanking({ limit: 10, minSamples: 5, minRawPrice: 200 }).catch(
      () => [] as SpreadRankingRow[],
    ),
  ]);

  const allTrending = [...opTop, ...pkmTop]
    .sort((a, b) => b.pct_change - a.pct_change)
    .slice(0, 10);

  // 過去/次週の slug
  const prev = (() => {
    const d = new Date();
    const { year, week } = parsed;
    d.setUTCFullYear(year, 0, 4);
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() || 7) + 1 + (week - 1) * 7 - 7);
    const isoY = d.getUTCFullYear();
    const j4 = new Date(Date.UTC(isoY, 0, 4));
    const j4Day = j4.getUTCDay() || 7;
    const dayDiff = (d.getTime() - j4.getTime()) / 86400000 + j4Day - 1;
    const prevWeek = Math.floor(dayDiff / 7) + 1;
    return formatWeekSlug(isoY, prevWeek);
  })();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${range} 週次 値上がりレポート`,
    description: `${range} の週間値上がりカードと PSA10 倍率上位の集計レポート`,
    datePublished: new Date().toISOString(),
    author: { "@type": "Organization", name: "TCG Authority" },
    publisher: { "@type": "Organization", name: "TCG Authority", url: SITE_URL },
    url: `${SITE_URL}/weekly/${slug}`,
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/" className="hover:underline">トップ</Link>
        <span className="mx-1.5">/</span>
        <Link href="/weekly" className="hover:underline">週次レポート</Link>
        <span className="mx-1.5">/</span>
        <span>{slug}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          📊 {range} 週次 値上がりレポート
          {isCurrent && (
            <span className="ml-2 px-2 py-0.5 rounded bg-yellow-400 text-yellow-900 text-xs font-bold align-middle">
              最新
            </span>
          )}
        </h1>
        <p className="text-sm text-gray-700 leading-relaxed">
          ワンピース・ポケモンカードの直近1週間 (
          {range}) で
          <strong>販売中央値が上昇したカード TOP10</strong> と{" "}
          <strong>Raw → PSA10 倍率上位</strong> をまとめました。
          {!isCurrent && (
            <>
              {" "}本ページの数値は週次の集計スナップショットです。最新トレンドは{" "}
              <Link href="/trending" className="text-blue-700 hover:underline">
                値上がりランキング
              </Link>{" "}
              から確認してください。
            </>
          )}
        </p>
      </header>

      {/* Section 1: 値上がり TOP10 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3 border-b pb-1">
          🚀 値上がり TOP10
          <span className="text-xs text-gray-500 font-normal ml-2">
            (販売中央値の上昇率順 / 両ブランド)
          </span>
        </h2>
        {allTrending.length === 0 ? (
          <p className="text-sm text-gray-500">
            この週はトレンドデータの集計がありません。
          </p>
        ) : (
          <ol className="space-y-1.5">
            {allTrending.map((c, i) => {
              const code = `${c.set_code}-${c.card_no}`;
              const up = c.pct_change >= 0;
              return (
                <li
                  key={c.card_id}
                  className="flex items-center gap-3 p-2 rounded border hover:shadow-sm transition-shadow bg-white"
                >
                  <span className="text-base font-bold text-gray-700 w-6 text-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <Link
                    href={`/cards/${code}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={`${c.name_ja} (${code})`}
                        className="w-10 h-auto rounded border flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 aspect-[5/7] bg-gray-100 rounded flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{c.name_ja}</div>
                      <div className="text-xs text-gray-500 truncate">
                        <span className="font-mono">{code}</span>
                        <span className="ml-2 text-gray-400">
                          {c.brand === "pokemon" ? "ポケカ" : "ワンピ"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold tabular-nums">
                        ¥{Math.round(c.now_price).toLocaleString()}
                      </div>
                      <div className={`text-xs font-bold ${up ? "text-red-600" : "text-blue-600"}`}>
                        {up ? "+" : ""}
                        {c.pct_change.toFixed(1)}%
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Section 2: PSA10 倍率 TOP10 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3 border-b pb-1">
          💰 鑑定で価格が跳ねるカード TOP10
          <span className="text-xs text-gray-500 font-normal ml-2">
            (Raw → PSA10 倍率順)
          </span>
        </h2>
        {spread.length === 0 ? (
          <p className="text-sm text-gray-500">倍率データの集計がありません。</p>
        ) : (
          <ol className="space-y-1.5">
            {spread.map((r, i) => {
              const code = `${r.set_code}-${r.card_no}`;
              return (
                <li
                  key={r.card_id}
                  className="flex items-center gap-3 p-2 rounded border bg-white hover:shadow-sm transition-shadow"
                >
                  <span className="text-base font-bold text-emerald-700 w-6 text-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <Link
                    href={`/cards/${code}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    {r.image_url ? (
                      <img
                        src={r.image_url}
                        alt={`${r.name_ja} (${code})`}
                        className="w-10 h-auto rounded border flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 aspect-[5/7] bg-gray-100 rounded flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{r.name_ja}</div>
                      <div className="text-xs text-gray-500 truncate">
                        <span className="font-mono">{code}</span>
                        <span className="ml-2">{r.rarity}</span>
                      </div>
                      <div className="text-[11px] text-gray-600 truncate">
                        Raw ¥{r.raw_median.toLocaleString()} → PSA10 ¥
                        {r.psa10_median.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-extrabold text-emerald-700 tabular-nums">
                        {r.multiplier.toFixed(1)}倍
                      </div>
                      <div className="text-[10px] text-gray-500 tabular-nums">
                        +¥{r.diff.toLocaleString()}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Navigation */}
      <section className="mt-8 border-t pt-4">
        <div className="flex justify-between gap-3 text-sm">
          <Link
            href={`/weekly/${prev}`}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            ← {prev}
          </Link>
          <Link href="/weekly" className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
            アーカイブ一覧
          </Link>
        </div>
      </section>

      <p className="mt-6 text-[11px] text-gray-500 leading-relaxed">
        ※ 数値は国内オークション・通販サイト・フリマの売却済みデータ等から集計した中央値で、
        実際の取引成立価格を保証しません。鑑定費用・送料・市況変動を踏まえてご判断ください。
      </p>
    </div>
  );
}
