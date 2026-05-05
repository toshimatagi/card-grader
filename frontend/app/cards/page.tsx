import Link from "next/link";
import type { Metadata } from "next";
import { getTrending, listSets, type TrendingCard } from "../../lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 600; // 10分

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export const metadata: Metadata = {
  title: "ワンピカード・ポケカ 価格DB - 全カード相場 & 値上がりランキング",
  description:
    "ワンピースカード・ポケモンカードの全カード相場をひと目で確認。複数の取扱いサイトから集計した中央値・買取価格・値上がりランキング・型番検索。フリマ購入前・PSA提出前のチェックに使える無料ツール。",
  alternates: { canonical: "/cards" },
  openGraph: {
    title: "ワンピカード・ポケカ 価格DB - TCG Authority",
    description:
      "ワンピース・ポケモンカードの全カード相場をひと目で確認。型番検索・値上がりランキング・AI鑑定対応。",
    url: "/cards",
  },
};

const FAQ = [
  {
    q: "ワンピカードやポケカの相場はどこで確認できますか?",
    a: "本サイトの価格DBで、ワンピース・ポケモンカードの全カード相場 (販売中央値・買取価格) を無料で確認できます。複数の取扱いサイトから日次で集計しています。",
  },
  {
    q: "型番からカードの価格を調べられますか?",
    a: "ワンピースは「OP15-118」「ST30-001」、ポケモンカードは「M04-117」「SV6-103」といった型番で個別ページに直接アクセスできます。バリアント別 (通常 / パラレル / アルトアート等) の価格も並べて確認可能です。",
  },
  {
    q: "値上がりしているカードを知りたいです",
    a: "値上がりランキングで、24時間 / 7日間 / 30日間 の販売価格・買取価格の上昇率トップを表示しています。ブランド別 (ワンピ・ポケカ) で切替できます。",
  },
  {
    q: "PSA鑑定に出す前にカードの状態を確認できますか?",
    a: "鑑定ツールに表面・裏面の写真をアップロードすると、センタリング・コーナー・エッジ・サーフェスのスコアを自動算出します。PSA / BGS 提出前のセルフチェックや、フリマ購入前のリスク確認に使えます。",
  },
  {
    q: "価格データの更新頻度はどのくらいですか?",
    a: "ワンピース系の主要セット (現役ブースター) は1時間おきに自動更新。それ以外のセットは日次〜週次で更新しています。ポケカは現役 MEGA シリーズを優先的に取得しています。",
  },
];

async function safeTrending(brand: "onepiece" | "pokemon", limit: number): Promise<TrendingCard[]> {
  try {
    return await getTrending({ brand, periodHours: 168, priceType: "sell", limit });
  } catch {
    return [];
  }
}

async function safeSets(brand: "onepiece" | "pokemon") {
  try {
    return (await listSets(brand)).sets;
  } catch {
    return [];
  }
}

export default async function CardsLandingPage() {
  const [opTrending, pkmTrending, opSets, pkmSets] = await Promise.all([
    safeTrending("onepiece", 5),
    safeTrending("pokemon", 5),
    safeSets("onepiece"),
    safeSets("pokemon"),
  ]);

  // FAQPage JSON-LD (SEO)
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  // 主要セット (新しい順に上位)
  const opTopSets = [...opSets].sort((a, b) => b.set_code.localeCompare(a.set_code)).slice(0, 12);
  const pkmTopSets = [...pkmSets].sort((a, b) => b.set_code.localeCompare(a.set_code)).slice(0, 12);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-3">
          ワンピカード・ポケカ 全カード相場 & 値上がりランキング
        </h1>
        <p className="text-sm text-gray-700 leading-relaxed">
          ワンピースカード・ポケモンカードの全カード相場 (販売中央値 / 買取価格 / 値上がり率)
          を無料で検索できます。型番・カード名・セット・レアリティで絞り込み、フリマ購入前・PSA
          提出前のチェック、仕入れ判断に。鑑定ツールでカードの状態スコアも自動算出。
        </p>
      </section>

      {/* ブランド大カード */}
      <section className="grid sm:grid-cols-2 gap-4 mb-10">
        <Link
          href="/cards/onepiece"
          className="block border-2 border-red-200 bg-red-50/40 rounded-xl p-5 hover:shadow-lg hover:border-red-400 transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🏴‍☠️</span>
            <div>
              <div className="font-bold text-lg">ワンピカード価格DB</div>
              <div className="text-xs text-gray-500">ONE PIECE Card Game</div>
            </div>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            OP / ST / EB / PRB シリーズ全カードの最新相場。バリアント (通常 / パラレル / スーパーパラレル / アルトアート) 別価格・買取率・信頼度を表示。
          </p>
          {opTopSets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {opTopSets.slice(0, 6).map((s) => (
                <span
                  key={s.set_code}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-red-200 text-red-700"
                >
                  {s.set_code}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 text-sm font-medium text-red-700">
            ワンピカードを見る →
          </div>
        </Link>

        <Link
          href="/cards/pokemon"
          className="block border-2 border-yellow-200 bg-yellow-50/40 rounded-xl p-5 hover:shadow-lg hover:border-yellow-400 transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">⚡</span>
            <div>
              <div className="font-bold text-lg">ポケカ価格DB</div>
              <div className="text-xs text-gray-500">Pokemon Trading Card Game</div>
            </div>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            MEGA / SV / SM / S シリーズ全カードの最新相場。AR / SAR / SR / UR / MUR 等のレアリティ別、ex / 進化形含む全バリアント対応。
          </p>
          {pkmTopSets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {pkmTopSets.slice(0, 6).map((s) => (
                <span
                  key={s.set_code}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-yellow-300 text-yellow-800"
                >
                  {s.set_code}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 text-sm font-medium text-yellow-800">
            ポケカを見る →
          </div>
        </Link>
      </section>

      {/* 値上がり + 鑑定ナビ */}
      <section className="grid sm:grid-cols-2 gap-4 mb-10">
        <Link
          href="/trending"
          className="block border rounded-lg p-4 hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📈</span>
            <div className="font-bold">値上がりランキング</div>
          </div>
          <p className="text-xs text-gray-600">
            24時間 / 7日 / 30日の販売価格・買取価格の騰落率トップ。ブランド別切替対応。
          </p>
        </Link>
        <Link
          href="/"
          className="block border rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📸</span>
            <div className="font-bold">AI 鑑定 (表裏チェック)</div>
          </div>
          <p className="text-xs text-gray-600">
            写真をアップでセンタリング・コーナー・エッジ・サーフェスを自動測定。PSA 提出前のセルフチェックに。
          </p>
        </Link>
      </section>

      {/* 値上がりプレビュー */}
      {(opTrending.length > 0 || pkmTrending.length > 0) && (
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">直近7日間の値上がりカード</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {opTrending.length > 0 && (
              <TrendingPreview brand="ワンピース" items={opTrending} link="/trending?brand=onepiece" />
            )}
            {pkmTrending.length > 0 && (
              <TrendingPreview brand="ポケモン" items={pkmTrending} link="/trending?brand=pokemon" />
            )}
          </div>
        </section>
      )}

      {/* 主要セットリンク (内部リンク強化) */}
      {opTopSets.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3">ワンピカード 主要セット</h2>
          <div className="flex flex-wrap gap-1.5">
            {opTopSets.map((s) => (
              <Link
                key={s.set_code}
                href={`/cards/onepiece?set=${s.set_code}`}
                className="text-xs px-2 py-1 rounded border border-red-200 bg-white hover:bg-red-50 text-red-700"
              >
                {s.set_code}
                <span className="text-gray-400 ml-1">{s.count}枚</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {pkmTopSets.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3">ポケカ 主要セット</h2>
          <div className="flex flex-wrap gap-1.5">
            {pkmTopSets.map((s) => (
              <Link
                key={s.set_code}
                href={`/cards/pokemon?set=${s.set_code}`}
                className="text-xs px-2 py-1 rounded border border-yellow-300 bg-white hover:bg-yellow-50 text-yellow-800"
              >
                {s.set_code}
                <span className="text-gray-400 ml-1">{s.count}枚</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">よくある質問</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="rounded-lg border bg-white p-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="font-medium text-sm cursor-pointer flex items-center justify-between gap-2">
                <span>Q. {f.q}</span>
                <span className="text-gray-400 text-xs">▼</span>
              </summary>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed">A. {f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-gray-500">
        ※ 表示価格は複数の取扱いサイトから集計した中央値です。最終的な売買価格を保証するものではありません。
      </p>
    </div>
  );
}

function TrendingPreview({
  brand,
  items,
  link,
}: {
  brand: string;
  items: TrendingCard[];
  link: string;
}) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">{brand}</h3>
        <Link href={link} className="text-xs text-blue-600 hover:underline">
          すべて見る →
        </Link>
      </div>
      <ol className="space-y-1.5">
        {items.slice(0, 5).map((c, i) => {
          const code = `${c.set_code}-${c.card_no}`;
          return (
            <li key={c.card_id}>
              <Link
                href={`/cards/${code}`}
                className="flex items-center gap-2 text-xs hover:bg-gray-50 rounded px-1.5 py-1"
              >
                <span className="text-gray-400 w-4 text-center">{i + 1}</span>
                <span className="flex-1 truncate font-medium">{c.name_ja}</span>
                <span className="text-gray-500 tabular-nums">¥{Math.round(c.now_price).toLocaleString()}</span>
                <span
                  className={`tabular-nums w-12 text-right ${
                    c.pct_change >= 0 ? "text-red-600" : "text-blue-600"
                  }`}
                >
                  {c.pct_change >= 0 ? "+" : ""}
                  {c.pct_change.toFixed(0)}%
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
