import Link from "next/link";
import type { Metadata } from "next";
import {
  searchCards,
  listSets,
  listRarities,
  attachLatestPrices,
  type CardSummaryWithPrice,
} from "../../../lib/api";
import { CardsFilterForm } from "../../../components/cards/CardsFilterForm";
import {
  POKEMON_SETS,
  formatPokemonSetLabel,
  getPokemonSetMeta,
} from "../../../lib/pokemonSets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ポケカ価格DB - 全カード相場",
  description:
    "ポケモンカードゲーム全カードの最新相場 (販売価格・買取価格)。複数の取扱いサイトから集計した中央値を表示。レギュレーション別・カード名検索対応。",
  alternates: { canonical: "/cards/pokemon" },
  openGraph: {
    title: "ポケカ価格DB - TCG Authority",
    description: "ポケモンカード全カードの最新相場 (中央値) をセット別・カード名検索で確認。",
    url: "/cards/pokemon",
  },
};

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

const BRAND = "pokemon";

export default async function PokemonCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; q?: string; rarity?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const sort = sp.sort || "code";

  const [sets, rarities, result] = await Promise.all([
    listSets(BRAND).catch(() => ({ sets: [] })),
    listRarities(BRAND).catch(() => [] as string[]),
    searchCards({
      brand: BRAND,
      set_code: sp.set,
      rarity: sp.rarity,
      q: sp.q,
      limit: 200,
    }).catch(() => ({ items: [], count: 0 })),
  ]);

  const priced = await attachLatestPrices(result.items, 168).catch(
    () => result.items.map((c) => ({ ...c, sell_price: null, buy_price: null })) as CardSummaryWithPrice[]
  );

  // 型番でグループ化（variant 別に分かれているため）
  const groupMap = new Map<string, CardSummaryWithPrice[]>();
  for (const c of priced) {
    const key = `${c.set_code}-${c.card_no}`;
    const list = groupMap.get(key) ?? [];
    list.push(c);
    groupMap.set(key, list);
  }

  const groups: Group[] = Array.from(groupMap.entries()).map(([code, variants]) => {
    const withImage = variants.find((v) => v.image_url) ?? variants[0];
    const sells = variants
      .map((v) => v.sell_price)
      .filter((p): p is number => p != null);
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

  groups.sort((a, b) => {
    switch (sort) {
      case "price-desc": {
        const ap = a.best_sell ?? -1;
        const bp = b.best_sell ?? -1;
        if (ap !== bp) return bp - ap;
        return a.code.localeCompare(b.code);
      }
      case "price-asc": {
        const ap = a.best_sell ?? Number.MAX_SAFE_INTEGER;
        const bp = b.best_sell ?? Number.MAX_SAFE_INTEGER;
        if (ap !== bp) return ap - bp;
        return a.code.localeCompare(b.code);
      }
      case "name":
        return a.name_ja.localeCompare(b.name_ja, "ja");
      case "code":
      default: {
        const setCmp = a.set_code.localeCompare(b.set_code);
        if (setCmp !== 0) return setCmp;
        return a.card_no.localeCompare(b.card_no);
      }
    }
  });

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/cards" className="hover:underline">価格DB</Link>
        <span className="mx-1.5">/</span>
        <span>ポケモンカード</span>
      </nav>
      <h1 className="text-2xl font-bold mb-2">ポケモンカード価格DB</h1>
      <p className="text-sm text-gray-600 mb-6">
        各型番のバリアント別価格推移を閲覧できます。表示価格は複数サイトから集計した中央値。
      </p>

      <CardsFilterForm
        sets={sets.sets}
        rarities={rarities}
        initialSet={sp.set ?? ""}
        initialRarity={sp.rarity ?? ""}
        initialQ={sp.q ?? ""}
        initialSort={sort}
        action="/cards/pokemon"
        setLabels={Object.fromEntries(
          sets.sets.map((s) => [s.set_code, formatPokemonSetLabel(s.set_code)])
        )}
      />

      {/* セット (弾) の見出しチップ — メタの全弾を表示しSEO内部リンクを増やす */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1.5">対応弾</div>
        <div className="flex flex-wrap gap-1.5">
          {(() => {
            const dataCounts = Object.fromEntries(
              sets.sets.map((s) => [s.set_code, s.count]),
            );
            const allCodes = Array.from(
              new Set([
                ...sets.sets.map((s) => s.set_code),
                ...Object.keys(POKEMON_SETS),
              ]),
            ).sort((a, b) => b.localeCompare(a));
            return allCodes.map((code) => {
              const meta = getPokemonSetMeta(code);
              const cnt = dataCounts[code] ?? 0;
              return (
                <Link
                  key={code}
                  href={`/cards/pokemon/${code}`}
                  className={`text-xs px-2 py-1 rounded border bg-white hover:bg-yellow-50 ${
                    sp.set === code
                      ? "border-yellow-500 ring-1 ring-yellow-300"
                      : "border-yellow-300"
                  } text-yellow-900`}
                >
                  <span className="font-mono">{code}</span>
                  {meta && <span className="ml-1">{meta.name}</span>}
                  <span className="text-gray-400 ml-1">
                    ({cnt > 0 ? cnt : "予定"})
                  </span>
                </Link>
              );
            });
          })()}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-gray-500">
          該当するカードがありません。フィルタや検索条件を変更してください。
        </p>
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
                    alt={g.name_ja}
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
                      <span className="text-[10px] text-gray-400 font-normal ml-1">最高値</span>
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
    </div>
  );
}
