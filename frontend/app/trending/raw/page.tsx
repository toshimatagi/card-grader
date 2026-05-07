import Link from "next/link";
import type { Metadata } from "next";
import { listGradeRanking, type GradeRankingRow } from "../../../lib/api";

export const revalidate = 1800;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

const BRANDS = [
  { key: "all", label: "すべて", short: "全ブランド" },
  { key: "pokemon", label: "ポケカ", short: "ポケモンカード" },
  { key: "onepiece", label: "ワンピ", short: "ワンピカード" },
] as const;

type SearchParams = { brand?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const brand = BRANDS.find((b) => b.key === sp.brand) ?? BRANDS[0];
  const title = `Raw (未鑑定) 高額カードランキング (${brand.short})`;
  const description = `${brand.short}で未鑑定 (Raw) のままでも高値で取引されるカードを中央値の高い順にランキング。フリマ・オークションでの実売価格ベース。`;
  return {
    title,
    description,
    keywords: [
      "Raw 高額",
      "未鑑定 高額",
      "ポケカ 高額カード",
      "ワンピカード 高額",
      "未鑑定 相場",
      "メルカリ 高額",
      "オークション 落札",
    ],
    alternates: {
      canonical: `/trending/raw${brand.key !== "all" ? `?brand=${brand.key}` : ""}`,
    },
    openGraph: { title, description, url: `/trending/raw`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TrendingRawPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const brand = BRANDS.find((b) => b.key === sp.brand) ?? BRANDS[0];

  const rows = await listGradeRanking({
    grade: "raw",
    brand: brand.key === "all" ? undefined : brand.key,
    limit: 100,
    minSamples: 5,
  }).catch(() => [] as GradeRankingRow[]);

  const top1 = rows[0];

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/trending" className="hover:underline">
          値上がり / ランキング
        </Link>
        <span className="mx-1.5">/</span>
        <span>Raw 高額TOP</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold mb-2">
          📦 Raw (未鑑定) 高額カードランキング
          <span className="ml-2 text-sm text-gray-500 font-normal">
            ({brand.short})
          </span>
        </h1>
        <p className="text-sm text-gray-700 leading-relaxed">
          国内オークション・フリマで Raw (未鑑定) のまま売却された高額カードランキング。
          {top1 && (
            <>
              {" "}1位は「{top1.name_ja}」({top1.set_code}-{top1.card_no}) の{" "}
              <strong>¥{top1.price_median.toLocaleString()}</strong>。
            </>
          )}
        </p>
      </header>

      <div className="mb-5 flex gap-1 border-b">
        {BRANDS.map((b) => (
          <Link
            key={b.key}
            href={`/trending/raw${b.key === "all" ? "" : `?brand=${b.key}`}`}
            className={`px-4 py-2 text-sm border-b-2 ${
              b.key === brand.key
                ? "border-gray-700 text-gray-900 font-semibold"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {b.label}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2 text-xs">
        <Link
          href={`/trending/psa10${brand.key === "all" ? "" : `?brand=${brand.key}`}`}
          className="px-3 py-1.5 rounded border border-amber-300 bg-white hover:bg-amber-50 text-amber-900"
        >
          🏆 PSA10 高額TOP
        </Link>
        <Link
          href={`/trending/spread${brand.key === "all" ? "" : `?brand=${brand.key}`}`}
          className="px-3 py-1.5 rounded border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900"
        >
          💰 Raw→PSA10 倍率TOP
        </Link>
        <Link
          href={`/trending${brand.key === "all" ? "" : `?brand=${brand.key}`}`}
          className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
        >
          販売価格 値上がりランキング
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded p-6 text-center text-sm text-gray-600">
          <p>Raw 相場データを集計中です。</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.card_id}
              className="flex items-center gap-3 p-3 border rounded hover:shadow-sm transition-shadow"
            >
              <div
                className={`text-lg font-bold w-8 text-center flex-shrink-0 ${
                  i < 3 ? "text-gray-700" : "text-gray-500"
                }`}
              >
                {i + 1}
              </div>
              <Link
                href={`/cards/${r.set_code}-${r.card_no}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                {r.image_url ? (
                  <img
                    src={r.image_url}
                    alt={`${r.name_ja} (${r.set_code}-${r.card_no})`}
                    className="w-12 h-auto rounded border flex-shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 aspect-[5/7] bg-gray-100 rounded flex-shrink-0 flex items-center justify-center text-[8px] text-gray-400">
                    No Img
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">
                    {r.name_ja}
                  </div>
                  <div className="text-xs text-gray-500">
                    <span className="font-mono">
                      {r.set_code}-{r.card_no}
                    </span>
                    <span className="ml-2">{r.rarity}</span>
                    <span className="ml-2 text-gray-400">
                      {r.brand === "pokemon" ? "ポケカ" : "ワンピ"}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-extrabold text-gray-900 tabular-nums">
                    ¥{r.price_median.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {r.sample_count}件・Raw中央値
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-6 text-[11px] text-gray-500 leading-relaxed">
        ※ 表示価格は国内オークション・フリマの売却済みデータから集計した中央値で、出品者によりばらつきがあります。
      </p>
    </div>
  );
}
