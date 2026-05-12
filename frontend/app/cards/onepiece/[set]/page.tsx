import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  searchCards,
  attachLatestPrices,
  type CardSummaryWithPrice,
} from "../../../../lib/api";
import {
  ONEPIECE_SETS,
  getOnePieceSetMeta,
} from "../../../../lib/onepieceSets";

export const revalidate = 1800; // 30 min ISR

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

type Group = {
  code: string;
  name_ja: string;
  set_code: string;
  card_no: string;
  image_url: string | null;
  rarities: string[];
  variant_count: number;
  best_sell: number | null;
};

export async function generateStaticParams() {
  return Object.keys(ONEPIECE_SETS).map((set) => ({ set: set.toUpperCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ set: string }>;
}): Promise<Metadata> {
  const { set } = await params;
  const setCode = set.toUpperCase();
  const meta = getOnePieceSetMeta(setCode);
  if (!meta) {
    return {
      title: `${setCode} - ワンピカード価格DB | TCG Authority`,
      alternates: { canonical: `/cards/onepiece/${setCode}` },
    };
  }
  const title = `ワンピカード「${meta.name}」(${setCode}) 全カード相場 - ${meta.releaseDate}発売`;
  const description = `ONE PIECEカードゲーム「${meta.name}」(${setCode}, ${meta.releaseDate}発売・${meta.kind}) の全カード相場・買取価格・値上がり情報。販売中央値と買取相場を一覧でチェック。`;
  return {
    title,
    description,
    keywords: [
      `${meta.name}`,
      `ワンピカード ${setCode}`,
      `${setCode} 相場`,
      `${setCode} 買取`,
      `${meta.name} カードリスト`,
      `${meta.name} SEC`,
      `${meta.name} L パラレル`,
      `${meta.name} SR`,
      "ワンピースカード 価格",
      "ワンピカード 値上がり",
    ],
    alternates: { canonical: `/cards/onepiece/${setCode}` },
    openGraph: {
      title,
      description,
      url: `/cards/onepiece/${setCode}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function OnePieceSetPage({
  params,
}: {
  params: Promise<{ set: string }>;
}) {
  const { set } = await params;
  const setCode = set.toUpperCase();
  const meta = getOnePieceSetMeta(setCode);

  if (!meta) {
    const probe = await searchCards({ brand: "onepiece", set_code: setCode, limit: 1 }).catch(
      () => ({ items: [], count: 0 }),
    );
    if (probe.items.length === 0) {
      notFound();
    }
  }

  const result = await searchCards({
    brand: "onepiece",
    set_code: setCode,
    limit: 500,
  }).catch(() => ({ items: [], count: 0 }));

  const priced = await attachLatestPrices(result.items, 168).catch(
    () =>
      result.items.map((c) => ({ ...c, sell_price: null, buy_price: null })) as CardSummaryWithPrice[],
  );

  const groupMap = new Map<string, CardSummaryWithPrice[]>();
  for (const c of priced) {
    const key = `${c.set_code}-${c.card_no}`;
    const list = groupMap.get(key) ?? [];
    list.push(c);
    groupMap.set(key, list);
  }

  const groups: Group[] = Array.from(groupMap.entries()).map(([code, variants]) => {
    const withImage = variants.find((v) => v.image_url) ?? variants[0];
    const sells = variants.map((v) => v.sell_price).filter((p): p is number => p != null);
    return {
      code,
      name_ja: withImage.name_ja,
      set_code: withImage.set_code,
      card_no: withImage.card_no,
      image_url: withImage.image_url,
      rarities: Array.from(new Set(variants.map((v) => v.rarity))),
      variant_count: variants.length,
      best_sell: sells.length ? Math.max(...sells) : null,
    };
  });

  const topCards = [...groups]
    .filter((g) => g.best_sell != null)
    .sort((a, b) => (b.best_sell ?? 0) - (a.best_sell ?? 0))
    .slice(0, 3);

  groups.sort((a, b) => {
    const setCmp = a.set_code.localeCompare(b.set_code);
    if (setCmp !== 0) return setCmp;
    return a.card_no.localeCompare(b.card_no);
  });

  const setName = meta ? meta.name : setCode;
  const releaseDate = meta?.releaseDate;
  const kind = meta?.kind;

  const isHotSet = ["OP14", "OP15", "EB04", "ST29", "ST30", "PRB02"].includes(setCode);

  const faq = [
    {
      q: `「${setName}」(${setCode}) の発売日はいつですか?`,
      a: meta
        ? `「${setName}」は ${releaseDate} に発売された ONE PIECEカードゲームの${kind}です。`
        : `「${setCode}」の発売日情報は近日追加予定です。`,
    },
    {
      q: `${setCode} の全カードリストはどこで確認できますか?`,
      a: `本ページに ${setCode} 全カード (${groups.length}件) の型番・カード名・販売中央値・買取価格を一覧で掲載しています。型番をクリックするとバリアント別 (通常/パラレル/SEC/L/SR) の詳細価格を確認できます。`,
    },
    {
      q: `${setCode} で高額になりやすいカードは?`,
      a:
        topCards.length > 0
          ? `現時点で ${setCode} の販売中央値が高いカードは「${topCards[0].name_ja}」(¥${topCards[0].best_sell?.toLocaleString()})${topCards.length > 1 ? `、「${topCards[1].name_ja}」(¥${topCards[1].best_sell?.toLocaleString()})` : ""} などです。SEC・L パラレル・SP のレアリティが高額になりやすい傾向があります。`
          : `SEC (シークレット)・L (リーダー パラレル)・SP (スペシャル) のカードが高額になりやすい傾向があります。具体的な相場は本ページのカードリストをご確認ください。`,
    },
    {
      q: `${setCode} の価格はどのくらいの頻度で更新されますか?`,
      a: isHotSet
        ? `${setCode} は最新弾として1時間おきに自動更新しています。販売中央値・買取価格・値上がりトレンドをリアルタイムで反映します。`
        : `${setCode} は1日1回 (深夜) に全件自動更新しています。長期的な価格推移は個別カードページで90日グラフを確認できます。`,
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
    "@type": "CollectionPage",
    name: `ワンピカード「${setName}」(${setCode}) 全カード相場`,
    description: `「${setName}」(${setCode}) の全カード ${groups.length} 件の相場・買取価格・トレンド一覧`,
    url: `${SITE_URL}/cards/onepiece/${setCode}`,
    isPartOf: {
      "@type": "WebSite",
      name: "TCG Authority",
      url: SITE_URL,
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "TOP", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "価格DB", item: `${SITE_URL}/cards` },
        {
          "@type": "ListItem",
          position: 3,
          name: "ワンピカード",
          item: `${SITE_URL}/cards/onepiece`,
        },
        {
          "@type": "ListItem",
          position: 4,
          name: setCode,
          item: `${SITE_URL}/cards/onepiece/${setCode}`,
        },
      ],
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: groups.length,
      itemListElement: groups.slice(0, 30).map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/cards/${g.code}`,
        name: g.name_ja,
      })),
    },
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
        <Link href="/cards" className="hover:underline">
          価格DB
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/cards/onepiece" className="hover:underline">
          ワンピカード
        </Link>
        <span className="mx-1.5">/</span>
        <span>{setCode}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          {setCode} {setName}
        </h1>
        <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-3">
          {releaseDate && (
            <span className="px-2 py-1 bg-gray-100 rounded">
              発売: {releaseDate}
            </span>
          )}
          {kind && <span className="px-2 py-1 bg-gray-100 rounded">{kind}</span>}
          <span className="px-2 py-1 bg-orange-50 text-orange-900 rounded">
            登録 {groups.length} 件
          </span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          ONE PIECEカードゲーム「{setName}」({setCode}) の全カード相場・買取価格を一覧表示。
          {topCards.length > 0 && (
            <>
              現在の最高値は「{topCards[0].name_ja}」¥
              {topCards[0].best_sell?.toLocaleString()}。
            </>
          )}
          各型番をクリックすると、通常・パラレル・SEC・SR などバリアント別の詳細価格と過去90日の推移グラフを確認できます。
        </p>
      </header>

      {topCards.length > 0 && (
        <section className="mb-6 bg-orange-50 border border-orange-200 rounded p-4">
          <h2 className="text-sm font-bold mb-2">{setCode} 高額カード TOP3</h2>
          <ol className="space-y-1 text-sm">
            {topCards.map((g, i) => (
              <li key={g.code}>
                <span className="font-mono text-xs text-gray-500 mr-2">
                  #{i + 1}
                </span>
                <Link
                  href={`/cards/${g.code}`}
                  className="text-blue-700 hover:underline"
                >
                  {g.name_ja}
                </Link>
                <span className="text-gray-500 ml-2">
                  ({g.code}) ¥{g.best_sell?.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {groups.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded p-6 text-center">
          <p className="text-gray-600 mb-2">
            「{setName}」({setCode}) の価格データを準備中です。
          </p>
          <p className="text-xs text-gray-500 mb-4">
            複数の取扱いサイトから集計した相場データの登録を進めています。準備が整い次第、ここにカードリストが表示されます。
          </p>
          <Link
            href="/cards/onepiece"
            className="inline-block text-sm text-blue-700 hover:underline"
          >
            → ワンピカード価格DBトップへ戻る
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3">{groups.length} 件表示</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {groups.map((g) => (
              <Link
                key={g.code}
                href={`/cards/${g.code}`}
                className="border rounded p-3 hover:shadow-md transition-shadow flex flex-col"
              >
                {g.image_url ? (
                  <img
                    src={g.image_url}
                    alt={`${g.name_ja} (${g.code}) - ${setName}`}
                    className="w-full h-auto mb-2 rounded"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full aspect-[5/7] bg-gray-100 mb-2 rounded flex items-center justify-center text-gray-400 text-xs">
                    No Image
                  </div>
                )}
                <div className="text-xs text-gray-500">{g.code}</div>
                <div className="text-sm font-bold leading-tight mb-1 line-clamp-2">
                  {g.name_ja}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {g.rarities.slice(0, 3).join(" / ")}
                  {g.variant_count > 1 && ` · ${g.variant_count}種`}
                </div>
                <div className="mt-auto">
                  {g.best_sell != null ? (
                    <div className="text-sm font-semibold text-blue-700">
                      ¥{g.best_sell.toLocaleString()}
                      <span className="text-[10px] text-gray-400 font-normal ml-1">
                        最高値
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">取引履歴なし</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <section className="mt-10 border-t pt-6">
        <h2 className="text-lg font-bold mb-3">{setCode} よくある質問</h2>
        <dl className="space-y-3 text-sm">
          {faq.map((f, i) => (
            <div key={i}>
              <dt className="font-bold text-gray-800">Q. {f.q}</dt>
              <dd className="text-gray-700 mt-1">A. {f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8 text-xs text-gray-500 border-t pt-4">
        <h2 className="font-bold mb-2 text-gray-700">関連リンク</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/cards/onepiece"
            className="px-3 py-1 border rounded hover:bg-gray-50"
          >
            ワンピカード価格DBトップ
          </Link>
          <Link
            href="/trending"
            className="px-3 py-1 border rounded hover:bg-gray-50"
          >
            ワンピカード値上がりランキング
          </Link>
          <Link href="/cards" className="px-3 py-1 border rounded hover:bg-gray-50">
            価格DBランディング
          </Link>
        </div>
      </section>
    </div>
  );
}
