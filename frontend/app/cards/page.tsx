import Link from "next/link";
import { searchCards, listSets, type CardSummary } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const [sets, result] = await Promise.all([
    listSets("onepiece").catch(() => ({ sets: [] })),
    searchCards({
      brand: "onepiece",
      set_code: sp.set,
      q: sp.q,
      limit: 200,
    }).catch(() => ({ items: [], count: 0 })),
  ]);

  // 型番でグループ化（variant別に分かれているため）
  const grouped = new Map<string, CardSummary[]>();
  for (const c of result.items) {
    const key = `${c.set_code}-${c.card_no}`;
    const list = grouped.get(key) ?? [];
    list.push(c);
    grouped.set(key, list);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">ONE PIECE カード価格DB</h1>
      <p className="text-sm text-gray-600 mb-6">
        各型番のバリアント別価格推移を閲覧できます。
      </p>

      <form className="mb-6 flex gap-2 flex-wrap" action="/cards" method="GET">
        <select
          name="set"
          defaultValue={sp.set ?? ""}
          className="border px-3 py-2 rounded"
        >
          <option value="">全セット</option>
          {sets.sets.map((s) => (
            <option key={s.set_code} value={s.set_code}>
              {s.set_code} ({s.count})
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="カード名で検索"
          className="border px-3 py-2 rounded flex-1 min-w-[200px]"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          検索
        </button>
      </form>

      {grouped.size === 0 ? (
        <p className="text-gray-500">
          データがまだありません。クローラー初回実行後に表示されます。
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from(grouped.entries()).map(([code, variants]) => {
            const first = variants[0];
            return (
              <Link
                key={code}
                href={`/cards/${code}`}
                className="border rounded p-3 hover:shadow-md transition-shadow"
              >
                {first.image_url ? (
                  <img
                    src={first.image_url}
                    alt={first.name_ja}
                    className="w-full h-auto mb-2 rounded"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full aspect-[5/7] bg-gray-200 mb-2 rounded" />
                )}
                <div className="text-xs text-gray-500">{code}</div>
                <div className="text-sm font-bold truncate">{first.name_ja}</div>
                <div className="text-xs text-gray-500">
                  {variants.length} バリアント
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
