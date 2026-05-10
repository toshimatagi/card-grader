import Link from "next/link";
import type { Metadata } from "next";
import { listSpreadRanking, type SpreadRankingRow } from "../../../lib/api";
import ShareButtons from "../../../components/share/ShareButtons";

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
  const title = `Raw → PSA10 価格倍率 TOP・鑑定で旨味あるカード (${brand.short})`;
  const description = `${brand.short}で「Raw → PSA10 にしたとき価格が大きく跳ねるカード」を倍率順にランキング。仕入れ判断・PSA提出判断・利幅シミュレーションに使える独自ランキング。`;
  return {
    title,
    description,
    keywords: [
      "PSA10 倍率",
      "鑑定 利幅",
      "Raw PSA10 価格差",
      "PSA10 旨味",
      "PSA鑑定 仕入れ",
      "ポケカ PSA10 利幅",
      "ワンピカード PSA10 利幅",
      "PSA10 値段差",
      "鑑定 出すべき",
    ],
    alternates: {
      canonical: `/trending/spread${brand.key !== "all" ? `?brand=${brand.key}` : ""}`,
    },
    openGraph: { title, description, url: `/trending/spread`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TrendingSpreadPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const brand = BRANDS.find((b) => b.key === sp.brand) ?? BRANDS[0];

  const rows = await listSpreadRanking({
    brand: brand.key === "all" ? undefined : brand.key,
    limit: 50,
    minSamples: 3,
    minRawPrice: 100,
  }).catch(() => [] as SpreadRankingRow[]);

  const top1 = rows[0];

  const faq = [
    {
      q: "Raw → PSA10 倍率って何ですか?",
      a: "同じカードを未鑑定 (Raw) で売った場合と PSA10 鑑定で売った場合の価格比です。例えば Raw ¥2,250 / PSA10 ¥61,900 のカードは倍率 27.5倍。倍率が高いほど「鑑定で価格が跳ねる」=鑑定提出の旨味があるカードです。",
    },
    {
      q: "なぜ倍率の高いカードを狙うべきですか?",
      a: "PSA鑑定費用は1枚あたり ¥3,000〜¥10,000 程度。Raw → PSA10 の差額がこの費用を大きく上回るカードでないと利益は出ません。倍率10倍以上のカードは Raw 仕入れ→PSA10 鑑定→売却で利幅が出やすい候補です。ただし PSA10 取得率を考慮する必要があります。",
    },
    {
      q: "倍率が高いだけで仕入れていいですか?",
      a: "(1) PSA10 取得率: 状態の良いカードでも実際 PSA10 になる確率は 20〜50% 程度。(2) 鑑定費用・送料・期間 (1〜3ヶ月): キャッシュフローと損益分岐を確認。(3) 出品価格と取引成立率: 中央値は売れた価格なので「売れない」リスクは別。これらを踏まえて判断してください。",
    },
    {
      q: "AI鑑定でセルフチェックできますか?",
      a: "本サイトの AI鑑定機能で表面・裏面を撮影すると、センタリング・コーナー・エッジ・サーフェスのスコアが算出されます。総合スコア 9.5 以上なら PSA10 候補、8.5 以上なら PSA9 候補の参考目安。提出前のセルフチェックに使えます。",
    },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/trending" className="hover:underline">
          値上がり / ランキング
        </Link>
        <span className="mx-1.5">/</span>
        <span>Raw→PSA10 倍率TOP</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold mb-2">
          💰 Raw → PSA10 倍率ランキング
          <span className="ml-2 text-sm text-gray-500 font-normal">
            ({brand.short})
          </span>
        </h1>
        <ShareButtons
          url={`${SITE_URL}/trending/spread${brand.key === "all" ? "" : `?brand=${brand.key}`}`}
          text={`鑑定で価格が跳ねるカード TOP — Raw → PSA10 倍率ランキング (${brand.short})`}
          className="mb-3"
          compact
        />
        <p className="text-sm text-gray-700 leading-relaxed">
          鑑定で価格が大きく跳ねる「PSA10 提出旨味カード」TOP。Raw (未鑑定) と PSA10 の中央値比から倍率を算出。
          {top1 && (
            <>
              {" "}1位は「{top1.name_ja}」({top1.set_code}-{top1.card_no}) で
              Raw ¥{top1.raw_median.toLocaleString()} →
              PSA10 ¥{top1.psa10_median.toLocaleString()} の{" "}
              <strong>{top1.multiplier.toFixed(1)}倍</strong>。
            </>
          )}
        </p>
      </header>

      {/* ブランド切替 */}
      <div className="mb-5 flex gap-1 border-b">
        {BRANDS.map((b) => (
          <Link
            key={b.key}
            href={`/trending/spread${b.key === "all" ? "" : `?brand=${b.key}`}`}
            className={`px-4 py-2 text-sm border-b-2 ${
              b.key === brand.key
                ? "border-emerald-500 text-emerald-700 font-semibold"
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
          href={`/trending/raw${brand.key === "all" ? "" : `?brand=${brand.key}`}`}
          className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
        >
          Raw 高額TOP
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
          <p>Raw / PSA10 両方のデータが揃うカードを集計中です。</p>
          <p className="text-xs text-gray-500 mt-2">
            日次集計が進めばランキングが充実します。
          </p>
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
                  i < 3 ? "text-emerald-600" : "text-gray-500"
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
                  </div>
                  <div className="text-[11px] text-gray-600 mt-0.5">
                    Raw ¥{r.raw_median.toLocaleString()} → PSA10 ¥
                    {r.psa10_median.toLocaleString()}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-extrabold text-emerald-700 tabular-nums">
                    {r.multiplier.toFixed(1)}倍
                  </div>
                  <div className="text-[10px] text-gray-500 tabular-nums">
                    +¥{r.diff.toLocaleString()}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <section className="mt-10 border-t pt-6">
        <h2 className="text-lg font-bold mb-3">
          倍率ランキングの読み方 (FAQ)
        </h2>
        <dl className="space-y-3 text-sm">
          {faq.map((f, i) => (
            <div key={i}>
              <dt className="font-bold text-gray-800">Q. {f.q}</dt>
              <dd className="text-gray-700 mt-1">A. {f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6 p-4 rounded-lg border border-blue-200 bg-blue-50">
        <h3 className="font-bold text-sm mb-2 text-blue-900">
          💡 鑑定提出を検討中の方へ
        </h3>
        <p className="text-xs text-blue-900 leading-relaxed mb-3">
          倍率の高いカードでも、状態が完璧でないと PSA10 は取得できません。
          提出前に AI 鑑定でセンタリング・エッジ・サーフェスをチェックすることで、
          PSA10 / PSA9 が狙えるかの目安が分かります。
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          AI鑑定で表裏チェック →
        </Link>
      </div>

      <p className="mt-6 text-[11px] text-gray-500 leading-relaxed">
        ※ 倍率は集計データ (中央値) からの参考値で、実際の取引成立価格・PSA10取得率は保証しません。
        鑑定費用・送料・市況変動・取得率を踏まえてご判断ください。
      </p>
    </div>
  );
}
