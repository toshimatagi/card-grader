import Link from "next/link";
import type { Metadata } from "next";
import { listGradeRanking, type GradeRankingRow } from "../../../lib/api";

export const revalidate = 1800; // 30 min ISR

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

const BRANDS = [
  { key: "all", label: "すべて", short: "全ブランド" },
  { key: "pokemon", label: "ポケカ", short: "ポケモンカード" },
  { key: "onepiece", label: "ワンピ", short: "ワンピカード" },
] as const;

type Brand = (typeof BRANDS)[number]["key"];

type SearchParams = { brand?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const brand = BRANDS.find((b) => b.key === sp.brand) ?? BRANDS[0];
  const title = `PSA10 高額カードランキング (${brand.short})`;
  const description = `${brand.short}の PSA10 鑑定カード相場 TOP100。中央値の高い順にランキング表示。Raw との価格差・倍率も併記。フリマ仕入れ・PSA提出判断の参考に。`;
  return {
    title,
    description,
    keywords: [
      "PSA10 高額",
      "PSA10 ランキング",
      "ポケカ PSA10 値段",
      "ワンピカード PSA10",
      "ポケモンカード 鑑定 高額",
      "PSA10 相場",
      "PSA10 売却",
      "鑑定 利幅",
      "PSA 鑑定 値上がり",
    ],
    alternates: {
      canonical: `/trending/psa10${brand.key !== "all" ? `?brand=${brand.key}` : ""}`,
    },
    openGraph: {
      title,
      description,
      url: `/trending/psa10`,
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TrendingPsa10Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const brand = BRANDS.find((b) => b.key === sp.brand) ?? BRANDS[0];

  const rows = await listGradeRanking({
    grade: "psa10",
    brand: brand.key === "all" ? undefined : brand.key,
    limit: 100,
    minSamples: 3,
  }).catch(() => [] as GradeRankingRow[]);

  const top1 = rows[0];

  const faq = [
    {
      q: "PSA10 とは何ですか?",
      a: "PSA10 は米国 PSA (Professional Sports Authenticator) のグレードで最高評価 (Gem Mint)。センタリング・コーナー・エッジ・サーフェスがほぼ完璧な状態を意味し、Raw (未鑑定) と比べて数倍〜数十倍で取引されることがあります。",
    },
    {
      q: "PSA10 の相場はどこで確認できますか?",
      a: `本ページで ${brand.short} の PSA10 相場 TOP100 を中央値の高い順に表示しています。各カードページでは PSA9 / Raw との比較・倍率・サンプル数も確認できます。`,
    },
    {
      q: "PSA10 の価格はどう決まりますか?",
      a: "PSA10 の価格は (1) カード自体の人気・希少性、(2) PSA10 取得難易度 (= 状態が完璧な個体の希少さ)、(3) 直近の供給量 (新規 PSA10 流通)、で決まります。同一カードでも時期によって 50% 以上変動することがあります。",
    },
    {
      q: "PSA10 を狙うコツは?",
      a: "(1) 状態の良い未開封パックから出る初期状態の良いカードを狙う、(2) 表面・裏面の白かけ・角欠けがないか確認する、(3) 提出前に AI 鑑定でセンタリングをセルフチェックする、(4) 高額カードは無傷であれば PSA10 取得時の含み益が大きい (Raw との価格差倍率が高いカードほど旨味あり)。",
    },
    {
      q: "PSA10 で買い取ってもらうにはどこがいいですか?",
      a: "本サイトは買取仲介はしていません。PSA10 取得済みカードは Yahoo オークション・メルカリ・専門店買取などで取引されます。本サイトの相場 (中央値) を参考価格として活用してください。",
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

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `PSA10 高額カード TOP${rows.length}`,
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 30).map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/cards/${r.set_code}-${r.card_no}`,
      name: `${r.name_ja} (${r.set_code}-${r.card_no})`,
    })),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/trending" className="hover:underline">
          値上がり / ランキング
        </Link>
        <span className="mx-1.5">/</span>
        <span>PSA10 高額TOP</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold mb-2">
          🏆 PSA10 高額カードランキング
          <span className="ml-2 text-sm text-gray-500 font-normal">
            ({brand.short})
          </span>
        </h1>
        <p className="text-sm text-gray-700 leading-relaxed">
          国内オークション・フリマで売却された PSA10 鑑定カードの相場 (中央値) を高い順にランキング表示。
          {top1 && (
            <>
              {" "}現在 1位は「{top1.name_ja}」({top1.set_code}-{top1.card_no}) の{" "}
              <strong>¥{top1.price_median.toLocaleString()}</strong> です。
            </>
          )}
        </p>
      </header>

      {/* ブランド切替タブ */}
      <div className="mb-5 flex gap-1 border-b">
        {BRANDS.map((b) => (
          <Link
            key={b.key}
            href={`/trending/psa10${b.key === "all" ? "" : `?brand=${b.key}`}`}
            className={`px-4 py-2 text-sm border-b-2 ${
              b.key === brand.key
                ? "border-amber-500 text-amber-700 font-semibold"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {b.label}
          </Link>
        ))}
      </div>

      {/* 関連ランキングへの内部リンク */}
      <div className="mb-5 flex flex-wrap gap-2 text-xs">
        <Link
          href={`/trending/spread${brand.key === "all" ? "" : `?brand=${brand.key}`}`}
          className="px-3 py-1.5 rounded border border-amber-300 bg-white hover:bg-amber-50 text-amber-900"
        >
          💰 鑑定で旨味あるカード (Raw→PSA10 倍率TOP)
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
          <p>PSA10 相場データが揃うまでお待ちください。</p>
          <p className="text-xs text-gray-500 mt-2">
            国内オークション・フリマの売却済みデータから日次集計しています。
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
                  i < 3 ? "text-amber-600" : "text-gray-500"
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
                  <div className="text-lg font-extrabold text-amber-700 tabular-nums">
                    ¥{r.price_median.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {r.sample_count}件・PSA10中央値
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <section className="mt-10 border-t pt-6">
        <h2 className="text-lg font-bold mb-3">PSA10 ランキングの読み方 (FAQ)</h2>
        <dl className="space-y-3 text-sm">
          {faq.map((f, i) => (
            <div key={i}>
              <dt className="font-bold text-gray-800">Q. {f.q}</dt>
              <dd className="text-gray-700 mt-1">A. {f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-6 text-[11px] text-gray-500 leading-relaxed">
        ※ 表示価格は国内オークション・フリマの売却済みデータから集計した中央値で、出品者によりばらつきがあります。
        鑑定費用・送料・市況変動を踏まえてご判断ください。AIによる正式鑑定の結果ではありません。
      </p>
    </div>
  );
}
