import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCardByCode, type CardVariant, type PriceStats, type PriceConfidence } from "../../../lib/api";
import PriceChart from "../../../components/cards/PriceChart";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

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
  const codeUpper = data.code;
  const variants = data.cards
    .map((c) => {
      const sell = c.sell_price != null ? `¥${c.sell_price.toLocaleString()}` : "-";
      const buy = c.buy_price != null ? `¥${c.buy_price.toLocaleString()}` : "-";
      return `${VARIANT_LABEL[c.variant] ?? c.variant}: 販売${sell}/買取${buy}`;
    })
    .join(" / ");

  const title = `${first.name_ja} (${codeUpper}) 価格相場`;
  const description = `ワンピースカード「${first.name_ja}」(${codeUpper}) の最新相場。${variants}。複数の取扱いサイトから集計した中央値を表示。`;

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

  // JSON-LD 構造化データ (Product schema)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${data.cards[0].name_ja} (${data.code})`,
    sku: data.code,
    image: data.cards.map((c) => c.image_url).filter(Boolean),
    brand: { "@type": "Brand", name: "ONE PIECE Card Game" },
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

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="text-sm text-gray-500 mb-2">
        <a href="/cards" className="hover:underline">価格DB</a>
        <span className="mx-2">/</span>
        <span>{data.code}</span>
      </nav>

      <h1 className="text-2xl font-bold mb-4">
        {data.cards[0].name_ja}
        <span className="text-base text-gray-500 ml-3">{data.code}</span>
      </h1>

      <div className="grid md:grid-cols-[200px_1fr] gap-6 mb-8">
        <div className="flex flex-col gap-2">
          {data.cards.map((c) => (
            c.image_url && (
              <img
                key={c.id}
                src={c.image_url}
                alt={`${c.rarity} ${VARIANT_LABEL[c.variant] ?? c.variant}`}
                className="w-full rounded border"
              />
            )
          )).filter(Boolean).slice(0, 3)}
        </div>

        <div>
          <h2 className="font-bold mb-2">バリアント別 価格</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2 border-b">バリアント</th>
                <th className="p-2 border-b">レアリティ</th>
                <th className="p-2 border-b text-right">販売 (中央値)</th>
                <th className="p-2 border-b text-right">販売レンジ</th>
                <th className="p-2 border-b text-right">買取 (中央値)</th>
                <th className="p-2 border-b text-right">買取率</th>
                <th className="p-2 border-b">信頼度</th>
              </tr>
            </thead>
            <tbody>
              {data.cards.map((c) => {
                const buyRate =
                  c.sell_stats && c.buy_stats && c.sell_stats.median > 0
                    ? Math.round((c.buy_stats.median / c.sell_stats.median) * 100)
                    : null;
                const conf = c.sell_stats?.confidence ?? c.buy_stats?.confidence ?? null;
                return (
                  <tr key={c.id} className="border-b align-top">
                    <td className="p-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                        style={{ background: VARIANT_COLOR[c.variant] ?? "#999" }}
                      />
                      {VARIANT_LABEL[c.variant] ?? c.variant}
                    </td>
                    <td className="p-2">{c.rarity}</td>
                    <td className="p-2 text-right tabular-nums">
                      {c.sell_price != null ? `¥${c.sell_price.toLocaleString()}` : "-"}
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
                  </tr>
                );
              })}
            </tbody>
          </table>

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

          <p className="text-xs text-gray-500 mt-2">
            ※ 複数の取扱いサイトから集計した中央値を表示しています
          </p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="font-bold mb-2">販売価格の推移</h2>
        <PriceChart series={sellSeries} />
      </section>

      <section>
        <h2 className="font-bold mb-2">買取価格の推移</h2>
        <PriceChart series={buySeries} />
      </section>
    </div>
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
