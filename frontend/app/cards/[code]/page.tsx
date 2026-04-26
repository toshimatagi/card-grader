import { notFound } from "next/navigation";
import { getCardByCode, type CardVariant } from "../../../lib/api";
import PriceChart from "../../../components/cards/PriceChart";

export const dynamic = "force-dynamic";

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

  return (
    <div>
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
                <th className="p-2 border-b text-right">販売価格</th>
                <th className="p-2 border-b text-right">買取価格</th>
              </tr>
            </thead>
            <tbody>
              {data.cards.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="p-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                      style={{ background: VARIANT_COLOR[c.variant] ?? "#999" }}
                    />
                    {VARIANT_LABEL[c.variant] ?? c.variant}
                  </td>
                  <td className="p-2">{c.rarity}</td>
                  <td className="p-2 text-right">
                    {c.sell_price != null
                      ? `¥${c.sell_price.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="p-2 text-right">
                    {c.buy_price != null
                      ? `¥${c.buy_price.toLocaleString()}`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
