import Link from "next/link";
import type { Metadata } from "next";
import { getTrending, type TrendingCard } from "../../lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 600; // 10分

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

const PERIODS = [
  { key: "24h", label: "24時間", hours: 24 },
  { key: "7d", label: "7日間", hours: 168 },
  { key: "30d", label: "30日間", hours: 720 },
] as const;

const PRICE_TYPES = [
  { key: "sell", label: "販売価格" },
  { key: "buy", label: "買取価格" },
] as const;

const VARIANT_LABEL: Record<string, string> = {
  normal: "通常",
  parallel: "パラレル",
  super_parallel: "スーパーパラレル",
  alt_art: "アルトアート",
  manga: "マンガ",
  other: "その他",
};

type SearchParams = { period?: string; type?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[1];
  const ptype = PRICE_TYPES.find((p) => p.key === sp.type) ?? PRICE_TYPES[0];
  const title = `ワンピカード ${period.label}の値上がりランキング (${ptype.label})`;
  const description = `ワンピースカードゲームの${period.label}で${ptype.label}が上昇したカードTOP50。複数の取扱いサイトから集計した中央値ベース。`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/trending?period=${period.key}&type=${ptype.key}` },
    openGraph: { title, description },
  };
}

export default async function TrendingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[1];
  const ptype = PRICE_TYPES.find((p) => p.key === sp.type) ?? PRICE_TYPES[0];

  let items: TrendingCard[] = [];
  let error: string | null = null;
  try {
    items = await getTrending({
      periodHours: period.hours,
      priceType: ptype.key,
      limit: 50,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "取得に失敗しました";
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">値上がりランキング</h1>
      <p className="text-sm text-gray-600 mb-6">
        指定期間で{ptype.label}の中央値が上昇したカードTOP50。
      </p>

      {/* 期間タブ */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/trending?period=${p.key}&type=${ptype.key}`}
            scroll={false}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              p.key === period.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* 価格種別タブ */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {PRICE_TYPES.map((t) => (
          <Link
            key={t.key}
            href={`/trending?period=${period.key}&type=${t.key}`}
            scroll={false}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              t.key === ptype.key
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          データの取得に失敗しました: {error}
        </div>
      )}

      {!error && items.length === 0 && (
        <p className="text-gray-500">
          この期間で集計可能なデータがまだ十分にありません。
        </p>
      )}

      {items.length > 0 && (
        <ol className="space-y-2">
          {items.map((c, i) => {
            const code = `${c.set_code}-${c.card_no}`;
            const up = c.pct_change >= 0;
            const diff = c.now_price - c.past_price;
            return (
              <li key={c.card_id}>
                <Link
                  href={`/cards/${code}`}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:shadow-md transition-shadow bg-white"
                >
                  <div className="w-8 text-center text-sm font-bold text-gray-500">
                    {i + 1}
                  </div>
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={c.name_ja}
                      className="w-12 h-auto rounded"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-12 aspect-[5/7] bg-gray-200 rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">
                      {c.name_ja}
                    </div>
                    <div className="text-xs text-gray-500">
                      {code} · {VARIANT_LABEL[c.variant] ?? c.variant} · {c.rarity}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      ¥{Math.round(c.now_price).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      前: ¥{Math.round(c.past_price).toLocaleString()}
                    </div>
                  </div>
                  <div
                    className={`text-right min-w-[80px] font-bold ${
                      up ? "text-red-600" : "text-blue-600"
                    }`}
                  >
                    <div className="text-base">
                      {up ? "+" : ""}
                      {c.pct_change.toFixed(1)}%
                    </div>
                    <div className="text-xs">
                      {up ? "+" : ""}¥{Math.round(diff).toLocaleString()}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-xs text-gray-500 mt-6">
        ※ 複数の取扱いサイトから集計した中央値の比較です。在庫切れ・¥100未満は除外。
      </p>
    </div>
  );
}
