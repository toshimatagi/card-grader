import Link from "next/link";
import {
  getTrending,
  listSpreadRanking,
  type TrendingCard,
  type SpreadRankingRow,
} from "../../lib/api";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

type Stats = {
  cardCount: number;
  opCount: number;
  pkmCount: number;
  latestSnapshot: string | null;
};

async function countCards(brand: string, headers: HeadersInit): Promise<number> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cards?brand=eq.${brand}&select=id`,
      { method: "HEAD", headers, next: { revalidate: 600 } }
    );
    const range = res.headers.get("Content-Range");
    return range ? parseInt(range.split("/")[1], 10) || 0 : 0;
  } catch {
    return 0;
  }
}

async function getStats(): Promise<Stats> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { cardCount: 0, opCount: 0, pkmCount: 0, latestSnapshot: null };
  }
  const headers: HeadersInit = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Prefer: "count=exact",
  };

  const [opCount, pkmCount] = await Promise.all([
    countCards("onepiece", headers),
    countCards("pokemon", headers),
  ]);

  let latestSnapshot: string | null = null;
  try {
    const snapRes = await fetch(
      `${SUPABASE_URL}/rest/v1/price_snapshots?select=captured_at&order=captured_at.desc&limit=1`,
      { headers, next: { revalidate: 300 } }
    );
    const snaps = (await snapRes.json()) as { captured_at: string }[];
    if (Array.isArray(snaps) && snaps.length > 0) {
      latestSnapshot = snaps[0].captured_at;
    }
  } catch {
    /* noop */
  }

  return {
    cardCount: opCount + pkmCount,
    opCount,
    pkmCount,
    latestSnapshot,
  };
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - t) / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}時間前`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}日前`;
}

const BRAND_BADGE: Record<string, { label: string; cls: string }> = {
  onepiece: { label: "ワンピ", cls: "bg-red-100 text-red-700 border-red-200" },
  pokemon: { label: "ポケカ", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
};

export default async function HomeHero() {
  const [stats, opTrending, pkmTrending, spreadTop] = await Promise.all([
    getStats().catch(
      () => ({ cardCount: 0, opCount: 0, pkmCount: 0, latestSnapshot: null }) as Stats
    ),
    getTrending({ brand: "onepiece", periodHours: 168, priceType: "sell", limit: 5 }).catch(
      () => [] as TrendingCard[]
    ),
    getTrending({ brand: "pokemon", periodHours: 168, priceType: "sell", limit: 5 }).catch(
      () => [] as TrendingCard[]
    ),
    listSpreadRanking({ limit: 3, minSamples: 5, minRawPrice: 200 }).catch(
      () => [] as SpreadRankingRow[]
    ),
  ]);

  // 両ブランド合算で上昇率順 top 3
  const trending = [...opTrending, ...pkmTrending]
    .sort((a, b) => b.pct_change - a.pct_change)
    .slice(0, 3);

  return (
    <div className="mb-8">
      {/* ヒーロー */}
      <div className="text-center py-8 px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 text-white rounded-xl mb-6 shadow-lg">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 leading-tight">
          ワンピカード・ポケカの<span className="text-yellow-300">型番・相場・値上がり</span>を
          <br className="hidden sm:block" />
          まとめてチェック
        </h1>
        <p className="text-sm sm:text-base text-gray-200 mb-4 leading-relaxed">
          AIでカードを特定し、<span className="text-blue-300 font-semibold">価格DB</span>と照合。
          <br className="hidden sm:block" />
          <span className="text-gray-300">フリマ購入前・仕入れ判断・PSA提出前の確認に。</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
          {stats.cardCount > 0 && (
            <span className="px-3 py-1.5 bg-white/10 backdrop-blur rounded-full border border-white/10">
              🃏 <span className="font-bold">{stats.cardCount.toLocaleString()}</span> 枚収録
              {stats.opCount > 0 && stats.pkmCount > 0 && (
                <span className="text-gray-300 font-normal ml-1">
                  (ワンピ {stats.opCount.toLocaleString()} / ポケカ {stats.pkmCount.toLocaleString()})
                </span>
              )}
            </span>
          )}
          {stats.latestSnapshot && (
            <span className="px-3 py-1.5 bg-white/10 backdrop-blur rounded-full border border-white/10">
              🕒 価格更新{" "}
              <span className="font-bold">{relativeTime(stats.latestSnapshot)}</span>
            </span>
          )}
          <span className="px-3 py-1.5 bg-white/10 backdrop-blur rounded-full border border-white/10">
            🎴 ワンピ・ポケカ対応
          </span>
          <span className="px-3 py-1.5 bg-white/10 backdrop-blur rounded-full border border-white/10">
            🆓 完全無料
          </span>
        </div>
        {/* 主要導線 */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <a
            href="#grade"
            className="inline-block px-5 py-2 bg-yellow-400 text-gray-900 font-bold rounded-full text-sm hover:bg-yellow-300 transition-colors"
          >
            📸 カードを鑑定
          </a>
          <a
            href="/cards"
            className="inline-block px-5 py-2 bg-white/15 backdrop-blur text-white font-semibold rounded-full text-sm hover:bg-white/25 border border-white/20 transition-colors"
          >
            📚 価格DBを見る
          </a>
          <a
            href="/trending"
            className="inline-block px-5 py-2 bg-white/15 backdrop-blur text-white font-semibold rounded-full text-sm hover:bg-white/25 border border-white/20 transition-colors"
          >
            📈 値上がりカード
          </a>
          <a
            href="/trending/psa10"
            className="inline-block px-5 py-2 bg-amber-400/90 text-gray-900 font-bold rounded-full text-sm hover:bg-amber-300 transition-colors"
          >
            🏆 PSA10 高額TOP
          </a>
        </div>
      </div>

      {/* PSA10 倍率 ヒーロー — 鑑定で旨味のあるカードランキング */}
      {spreadTop.length > 0 && (
        <section className="mb-6 rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-yellow-50 p-4">
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-lg font-bold text-emerald-900">
              💰 鑑定で価格が跳ねるカード TOP3{" "}
              <span className="text-xs text-gray-600 font-normal">
                (Raw → PSA10 倍率)
              </span>
            </h2>
            <Link
              href="/trending/spread"
              className="text-sm text-emerald-700 hover:underline whitespace-nowrap"
            >
              倍率TOP全体 →
            </Link>
          </div>
          <p className="text-xs text-gray-700 mb-3 leading-relaxed">
            未鑑定 (Raw) と PSA10 で大きな価格差があるカード。
            状態が良ければ提出で利幅が出やすい候補。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {spreadTop.map((r, i) => {
              const code = `${r.set_code}-${r.card_no}`;
              const badge = BRAND_BADGE[r.brand] ?? null;
              return (
                <Link
                  key={r.card_id}
                  href={`/cards/${code}`}
                  className="flex items-center gap-2 p-2 rounded bg-white border border-emerald-200 hover:shadow-md transition-shadow"
                >
                  <span className="text-base font-bold text-emerald-700 w-5 text-center">
                    {i + 1}
                  </span>
                  {r.image_url ? (
                    <img
                      src={r.image_url}
                      alt={r.name_ja}
                      className="w-10 h-auto rounded border flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-10 aspect-[5/7] bg-gray-100 rounded flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">
                      {r.name_ja}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      <span className="font-mono">{code}</span>
                      {badge && (
                        <span className={`ml-1 px-1 rounded text-[9px] border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-600 truncate">
                      Raw ¥{r.raw_median.toLocaleString()} → PSA10 ¥
                      {r.psa10_median.toLocaleString()}
                    </div>
                  </div>
                  <span className="text-base font-extrabold text-emerald-700 whitespace-nowrap">
                    {r.multiplier.toFixed(1)}倍
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 値上がり Top 3 (両ブランド合算) */}
      {trending.length > 0 && (
        <section className="mb-2">
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-lg font-bold">
              📈 今週の値上がり Top3{" "}
              <span className="text-xs text-gray-500 font-normal">(7日間 / 両ブランド)</span>
            </h2>
            <Link href="/trending" className="text-sm text-blue-600 hover:underline">
              全ランキング →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {trending.map((c, i) => {
              const code = `${c.set_code}-${c.card_no}`;
              const up = c.pct_change >= 0;
              const badge = BRAND_BADGE[c.brand] ?? null;
              return (
                <Link
                  key={c.card_id}
                  href={`/cards/${code}`}
                  className="block border rounded-lg p-2 hover:shadow-md transition-shadow bg-white"
                >
                  <div className="relative">
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={c.name_ja}
                        className="w-full h-auto rounded"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full aspect-[5/7] bg-gray-100 rounded flex items-center justify-center text-[10px] text-gray-400">
                        No Image
                      </div>
                    )}
                    <span className="absolute top-1 left-1 w-6 h-6 rounded-full bg-yellow-400 text-gray-900 text-xs font-bold flex items-center justify-center shadow">
                      {i + 1}
                    </span>
                    {badge && (
                      <span
                        className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="text-[10px] text-gray-500">{code}</div>
                    <div className="text-xs font-bold leading-tight line-clamp-2 min-h-[2.4em]">
                      {c.name_ja}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold whitespace-nowrap">
                        ¥{Math.round(c.now_price).toLocaleString()}
                      </span>
                      <span
                        className={`text-xs font-bold whitespace-nowrap ${
                          up ? "text-red-600" : "text-blue-600"
                        }`}
                      >
                        {up ? "+" : ""}
                        {c.pct_change.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
