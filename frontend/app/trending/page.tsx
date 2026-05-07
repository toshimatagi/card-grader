import Link from "next/link";
import type { Metadata } from "next";
import { getTrending, type TrendingCard } from "../../lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 600; // 10分

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

const BRANDS = [
  { key: "onepiece", label: "ワンピ", short: "ワンピカード" },
  { key: "pokemon", label: "ポケカ", short: "ポケモンカード" },
] as const;

const PERIODS = [
  { key: "24h", label: "24時間", hours: 24 },
  { key: "7d", label: "7日間", hours: 168 },
  { key: "30d", label: "30日間", hours: 720 },
] as const;

const PRICE_TYPES = [
  { key: "sell", label: "販売価格" },
  { key: "buy", label: "買取価格" },
] as const;

const SORTS = [
  { key: "rate", label: "上昇率順" },
  { key: "diff", label: "上昇額順" },
  { key: "price", label: "現在価格順" },
] as const;

const LIMITS = [50, 100, 200] as const;

const VARIANT_LABEL: Record<string, string> = {
  normal: "通常",
  parallel: "パラレル",
  super_parallel: "スーパーパラレル",
  alt_art: "アルトアート",
  manga: "マンガ",
  other: "その他",
};

type SearchParams = {
  brand?: string;
  period?: string;
  type?: string;
  sort?: string;
  limit?: string;
};

function buildHref(base: Record<string, string>, override: Record<string, string>) {
  const merged = { ...base, ...override };
  const qs = new URLSearchParams(merged).toString();
  return `/trending?${qs}`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const brand = BRANDS.find((b) => b.key === sp.brand) ?? BRANDS[0];
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[1];
  const ptype = PRICE_TYPES.find((p) => p.key === sp.type) ?? PRICE_TYPES[0];
  const title = `${brand.label}カード ${period.label}の値上がりランキング (${ptype.label})`;
  const description = `${brand.short}の${period.label}で${ptype.label}が上昇したカードランキング。複数の取扱いサイトから集計した中央値ベース。`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/trending?brand=${brand.key}&period=${period.key}&type=${ptype.key}` },
    openGraph: { title, description },
  };
}

export default async function TrendingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const brand = BRANDS.find((b) => b.key === sp.brand) ?? BRANDS[0];
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[1];
  const ptype = PRICE_TYPES.find((p) => p.key === sp.type) ?? PRICE_TYPES[0];
  const sort = SORTS.find((s) => s.key === sp.sort) ?? SORTS[0];
  const limitNum = Number(sp.limit);
  const limit = (LIMITS as readonly number[]).includes(limitNum) ? limitNum : 50;

  const baseParams: Record<string, string> = {
    brand: brand.key,
    period: period.key,
    type: ptype.key,
    sort: sort.key,
    limit: String(limit),
  };

  let items: TrendingCard[] = [];
  let error: string | null = null;
  try {
    // 上位の母集団を多めに取り、フロントで並び替えて表示
    items = await getTrending({
      brand: brand.key,
      periodHours: period.hours,
      priceType: ptype.key,
      limit: Math.max(limit, 200),
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "取得に失敗しました";
  }

  const sorted = [...items].sort((a, b) => {
    if (sort.key === "diff") {
      return (b.now_price - b.past_price) - (a.now_price - a.past_price);
    }
    if (sort.key === "price") {
      return b.now_price - a.now_price;
    }
    return b.pct_change - a.pct_change;
  });
  const display = sorted.slice(0, limit);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">値上がりランキング</h1>
      <p className="text-sm text-gray-600 mb-3">
        指定期間で{ptype.label}の中央値が上昇した{brand.short}を表示。
      </p>

      {/* グレード別ランキングへの動線 */}
      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        <Link
          href={`/trending/psa10?brand=${brand.key}`}
          className="px-3 py-1.5 rounded border border-amber-300 bg-white hover:bg-amber-50 text-amber-900 font-medium"
        >
          🏆 PSA10 高額TOP
        </Link>
        <Link
          href={`/trending/spread?brand=${brand.key}`}
          className="px-3 py-1.5 rounded border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 font-medium"
        >
          💰 Raw→PSA10 倍率TOP
        </Link>
        <Link
          href={`/trending/raw?brand=${brand.key}`}
          className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
        >
          📦 Raw 高額TOP
        </Link>
      </div>

      {/* ブランドタブ */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {BRANDS.map((b) => (
          <Link
            key={b.key}
            href={buildHref(baseParams, { brand: b.key })}
            scroll={false}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              b.key === brand.key
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
            }`}
          >
            {b.label}
          </Link>
        ))}
      </div>

      {/* 期間タブ */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={buildHref(baseParams, { period: p.key })}
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
      <div className="flex gap-2 mb-3 flex-wrap">
        {PRICE_TYPES.map((t) => (
          <Link
            key={t.key}
            href={buildHref(baseParams, { type: t.key })}
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

      {/* ソートタブ */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={buildHref(baseParams, { sort: s.key })}
            scroll={false}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              s.key === sort.key
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* 件数切替 */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <span className="text-xs text-gray-500">表示件数:</span>
        {LIMITS.map((n) => (
          <Link
            key={n}
            href={buildHref(baseParams, { limit: String(n) })}
            scroll={false}
            className={`px-2.5 py-1 rounded text-xs border ${
              n === limit
                ? "bg-gray-700 text-white border-gray-700"
                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
            }`}
          >
            {n}
          </Link>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          データの取得に失敗しました: {error}
        </div>
      )}

      {!error && display.length === 0 && (
        <p className="text-gray-500">
          この期間で集計可能なデータがまだ十分にありません。
        </p>
      )}

      {display.length > 0 && (
        <ol className="space-y-2">
          {display.map((c, i) => {
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
                    <div className="w-12 aspect-[5/7] bg-gray-100 rounded flex items-center justify-center text-[8px] text-gray-400">
                      No Img
                    </div>
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
