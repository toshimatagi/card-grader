import Link from "next/link";
import type { Metadata } from "next";
import { getTrending, listSets, type TrendingCard } from "../../lib/api";
import { getPokemonSetMeta } from "../../lib/pokemonSets";

export const dynamic = "force-dynamic";
export const revalidate = 600; // 10分

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export const metadata: Metadata = {
  title: "ワンピカード・ポケカ 価格DB - 全カード相場 & 値上がりランキング",
  description:
    "ワンピースカード・ポケモンカードの全カード相場をひと目で確認。複数の取扱いサイトから集計した中央値・買取価格・値上がりランキング・型番検索。フリマ購入前・PSA提出前のチェックに使える無料ツール。",
  keywords: [
    "ワンピカード相場", "ワンピースカード 価格", "ONE PIECE TCG",
    "ポケカ相場", "ポケモンカード 価格", "ポケカ 買取",
    "カード価格DB", "TCG価格", "カード型番", "カード相場推移",
    "ワンピース 高額カード", "ポケモンカード 高額", "値上がりランキング",
    "ワンピカード SEC", "ワンピカード SR パラレル", "ポケカ SAR", "ポケカ UR",
    "OP15", "M04", "SV6", "PRB", "MEGA",
    "PSA 鑑定", "BGS 鑑定", "センタリング 自動", "状態チェック",
    "フリマ購入前", "メルカリ 購入前 確認", "仕入れ判断",
  ],
  alternates: { canonical: "/cards" },
  openGraph: {
    title: "ワンピカード・ポケカ 価格DB - TCG Authority",
    description:
      "ワンピース・ポケモンカードの全カード相場をひと目で確認。型番検索・値上がりランキング・AI鑑定対応。",
    url: "/cards",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ワンピカード・ポケカ 価格DB - TCG Authority",
    description: "全カード相場・値上がりランキング・AI鑑定の無料ツール",
  },
};

const FAQ = [
  {
    q: "ワンピカードやポケカの相場はどこで確認できますか?",
    a: "本サイトの価格DBで、ワンピース・ポケモンカードの全カード相場 (販売中央値・買取価格) を無料で確認できます。複数の取扱いサイトから日次〜時間単位で集計し、信頼度バッジ (高/中/低) を併記しています。",
  },
  {
    q: "型番からカードの価格を調べられますか?",
    a: "ワンピースは「OP15-118」「ST30-001」、ポケモンカードは「M04-117」「SV6-103」のような型番で個別ページに直接アクセスできます。バリアント別 (通常 / パラレル / アルトアート / SAR / UR 等) の価格も並べて確認可能です。",
  },
  {
    q: "値上がりしているカードを知りたいです",
    a: "値上がりランキングで、24時間 / 7日間 / 30日間 の販売価格・買取価格の上昇率トップを表示しています。ブランド別 (ワンピ・ポケカ) で切替できます。短期スパイクから長期トレンドまで把握可能です。",
  },
  {
    q: "PSA鑑定に出す前にカードの状態を確認できますか?",
    a: "鑑定ツールに表面・裏面の写真をアップロードすると、センタリング・コーナー・エッジ・サーフェスのスコアを自動算出します。PSA / BGS 提出前のセルフチェックや、フリマ購入前のリスク確認に使えます。",
  },
  {
    q: "価格データの更新頻度はどのくらいですか?",
    a: "現役の主要セット (ワンピは最新ブースター、ポケカは現行 MEGA シリーズ) は1時間おきに自動更新。それ以外のセットは1日1回 (深夜) に全件更新しています。価格推移は過去90日分のグラフで表示可能です。",
  },
  {
    q: "どのレアリティが高額になりやすいですか?",
    a: "ワンピースは SEC (シークレット)・L (リーダー パラレル)・SP (スペシャル)、ポケモンカードは SAR (スペシャルアートレア)・UR (ウルトラレア)・SR (スーパーレア) が高額になりやすい傾向です。同型番でもイラスト違い・縁取り違いで数倍の価格差になることがあります。",
  },
  {
    q: "ワンピカードの主要セット (OP15・PRB02 など) は対応していますか?",
    a: "ワンピースカードゲームの OP / ST / EB / PRB の全セットを対応しています。最新ブースターは1時間おきに更新、旧弾も日次で集計しています。",
  },
  {
    q: "ポケモンカードの MEGA シリーズや SV シリーズは対応していますか?",
    a: "ポケモンカードは MEGA (M / Ma シリーズ) と SV (スカーレット&バイオレット) シリーズの全カードに対応しています。最新弾 M04 ニンジャスピナー・M03 ムニキスゼロ・M2a MEGAドリームex も網羅。",
  },
  {
    q: "買取価格と販売価格の差から利幅を計算できますか?",
    a: "個別カードページで買取率 (買取中央値 / 販売中央値 × 100%) を表示しています。買取率が60%以上のカードは需要が高く転売しやすい傾向、50%未満は短期転売の利幅が薄いカードと判断できます。",
  },
  {
    q: "フリマで買う前にチェックすべきことは?",
    a: "(1) 型番・レアリティ表記が画像で確認できるか、(2) 高額バリアント (パラレル・SAR等) と通常版を混同していないか、(3) 表面・裏面・四隅の追加写真が出品されているか、(4) 当サイトの相場と乖離していないか の4点を確認してください。",
  },
  {
    q: "AI鑑定の精度はどのくらいですか? 公式 PSA と同じ結果になりますか?",
    a: "AI鑑定はあくまで提出前の参考スコアです。公式 PSA / BGS の判定とは一致しないことがあります。主にセンタリング・明らかなエッジ傷・角欠けを検出する用途で、最終判断は実物確認と公式鑑定機関にお任せください。",
  },
];

async function safeTrending(
  brand: "onepiece" | "pokemon",
  hours: number,
  limit: number,
): Promise<TrendingCard[]> {
  try {
    return await getTrending({ brand, periodHours: hours, priceType: "sell", limit });
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
  // 並列取得: 値上がり (24h/7d/30d × 2brand) + sets × 2brand
  const [
    op24h, op7d, op30d, pkm24h, pkm7d, pkm30d,
    opSets, pkmSets,
  ] = await Promise.all([
    safeTrending("onepiece", 24, 10),
    safeTrending("onepiece", 168, 10),
    safeTrending("onepiece", 720, 10),
    safeTrending("pokemon", 24, 10),
    safeTrending("pokemon", 168, 10),
    safeTrending("pokemon", 720, 10),
    safeSets("onepiece"),
    safeSets("pokemon"),
  ]);

  // 期間別 値上がり (両ブランド合算 → 上昇率順 top5)
  const merge = (a: TrendingCard[], b: TrendingCard[], n: number) =>
    [...a, ...b].sort((x, y) => y.pct_change - x.pct_change).slice(0, n);
  const trending24h = merge(op24h, pkm24h, 5);
  const trending7d = merge(op7d, pkm7d, 5);
  const trending30d = merge(op30d, pkm30d, 5);

  // 注目の高額カード TOP10 (両ブランド合算、現在価格降順)
  const allItems = [...op7d, ...pkm7d, ...op30d, ...pkm30d];
  const seen = new Set<string>();
  const expensiveTop: TrendingCard[] = [];
  for (const c of [...allItems].sort((a, b) => b.now_price - a.now_price)) {
    if (seen.has(c.card_id)) continue;
    seen.add(c.card_id);
    expensiveTop.push(c);
    if (expensiveTop.length >= 10) break;
  }

  // 集計件数 (対応カード件数を訴求)
  const opCardCount = opSets.reduce((s, x) => s + x.count, 0);
  const pkmCardCount = pkmSets.reduce((s, x) => s + x.count, 0);

  // FAQPage JSON-LD
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  // WebSite JSON-LD (Google sitelinks search box)
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TCG Authority",
    alternateName: ["TCGオーソリティ", "ワンピカード価格DB", "ポケカ価格DB"],
    url: SITE_URL,
    description:
      "ワンピカード・ポケカの全カード相場・値上がりランキング・AI状態鑑定が無料で使えるTCG価格データベース",
    inLanguage: "ja-JP",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/cards?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  // Organization JSON-LD
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TCG Authority",
    url: SITE_URL,
    description:
      "TCG (トレーディングカードゲーム) の価格DB・値上がりランキング・状態鑑定を提供する無料Webツール",
  };

  // 主要セット (新しい順に上位)
  const opTopSets = [...opSets].sort((a, b) => b.set_code.localeCompare(a.set_code)).slice(0, 12);
  const pkmTopSets = [...pkmSets].sort((a, b) => b.set_code.localeCompare(a.set_code)).slice(0, 12);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* H1 + リード */}
      <section className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-3">
          ワンピカード・ポケカ 全カード相場 & 値上がりランキング
        </h1>
        <p className="text-sm text-gray-700 leading-relaxed">
          ワンピースカード・ポケモンカードの<strong>全カード相場 (販売中央値 / 買取価格 / 値上がり率)</strong>
          を無料で検索できます。型番・カード名・セット・レアリティで絞り込み、フリマ購入前・PSA
          提出前のチェック、仕入れ判断に。AI鑑定ツールでカードの状態スコアも自動算出します。
        </p>
      </section>

      {/* H2: TCG Authority とは */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-1">TCG Authority とは</h2>
        <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
          <p>
            <strong>TCG Authority</strong> は、ワンピースカードゲームとポケモンカードゲームの相場・値上がり・状態鑑定を一括で確認できる<strong>無料ツール</strong>です。複数の取扱いサイトから1時間〜1日おきに価格データを集計し、各カードの<strong>販売中央値・買取価格・直近の値上がり率</strong>を表示します。
          </p>
          <p>
            フリマアプリでカードを購入する前、PSA / BGS の鑑定提出前、カードショップでの仕入れ判断、コレクションの時価評価など、TCG プレイヤー・コレクター・転売目的のいずれの用途にも対応しています。<strong>登録不要・完全無料</strong>でご利用いただけます。
          </p>
        </div>
      </section>

      {/* H2: ブランド別価格DB (大カード) */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-1">ブランド別 価格DB</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/cards/onepiece"
            className="block border-2 border-red-200 bg-red-50/40 rounded-xl p-5 hover:shadow-lg hover:border-red-400 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🏴‍☠️</span>
              <div>
                <h3 className="font-bold text-lg">ワンピカード価格DB</h3>
                <div className="text-xs text-gray-500">ONE PIECE Card Game</div>
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              OP / ST / EB / PRB シリーズ全カードの最新相場。バリアント (通常 / パラレル / スーパーパラレル / アルトアート) 別価格・買取率・信頼度を表示。
            </p>
            {opCardCount > 0 && (
              <div className="mt-2 text-xs text-red-700 font-medium">
                収録 {opCardCount.toLocaleString()}枚 / {opSets.length}セット
              </div>
            )}
            {opTopSets.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
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
                <h3 className="font-bold text-lg">ポケカ価格DB</h3>
                <div className="text-xs text-gray-500">Pokemon Trading Card Game</div>
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              MEGA / SV / SM / S シリーズ全カードの最新相場。AR / SAR / SR / UR / MUR 等のレアリティ別、ex / 進化形含む全バリアント対応。
            </p>
            {pkmCardCount > 0 && (
              <div className="mt-2 text-xs text-yellow-800 font-medium">
                収録 {pkmCardCount.toLocaleString()}枚 / {pkmSets.length}セット
              </div>
            )}
            {pkmTopSets.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
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
        </div>
      </section>

      {/* H2: 使い方 3ステップ */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-1">使い方 3ステップ</h2>
        <ol className="grid sm:grid-cols-3 gap-3">
          <li className="border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">1</span>
              <h3 className="font-bold text-sm">型番・カード名で検索</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              ワンピース「OP15-118」、ポケカ「M04-117」のような型番、またはカード名で検索。バリアント (通常/パラレル/SAR等) ごとの相場が一覧表示。
            </p>
          </li>
          <li className="border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">2</span>
              <h3 className="font-bold text-sm">販売・買取価格と推移を確認</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              中央値・最高値・買取率・信頼度バッジを比較。過去90日の価格推移グラフで値上がり/値下がりトレンドも把握できます。
            </p>
          </li>
          <li className="border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">3</span>
              <h3 className="font-bold text-sm">AI鑑定で状態スコア</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              表面/裏面の写真をアップロードすると、センタリング・エッジ・コーナー・サーフェスのスコアを自動算出。PSA 提出判断やフリマ購入前のリスクチェックに。
            </p>
          </li>
        </ol>
      </section>

      {/* H2: 値上がりランキング (期間別) */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-1">値上がりランキング (期間別)</h2>
        <p className="text-xs text-gray-600 mb-3">
          24時間 / 7日 / 30日 の販売価格中央値が上昇したカード TOP5 を表示。短期スパイクから長期トレンドまで把握できます。
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <TrendingPanel title="24時間" items={trending24h} link="/trending?period=24h" />
          <TrendingPanel title="7日間" items={trending7d} link="/trending?period=7d" />
          <TrendingPanel title="30日間" items={trending30d} link="/trending?period=30d" />
        </div>
      </section>

      {/* H2: 注目の高額カード */}
      {expensiveTop.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3 border-b pb-1">注目の高額カード TOP10</h2>
          <p className="text-xs text-gray-600 mb-3">
            直近で取引のあったカードのうち販売中央値が高いトップ10。PSA鑑定対象や高額取引の参考に。
          </p>
          <ol className="grid sm:grid-cols-2 gap-2">
            {expensiveTop.map((c, i) => {
              const code = `${c.set_code}-${c.card_no}`;
              return (
                <li key={c.card_id}>
                  <Link
                    href={`/cards/${code}`}
                    className="flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50"
                  >
                    <span className="w-5 text-center text-xs font-bold text-amber-600">{i + 1}</span>
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name_ja} className="w-8 h-auto rounded" loading="lazy" />
                    ) : (
                      <div className="w-8 aspect-[5/7] bg-gray-100 rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{c.name_ja}</div>
                      <div className="text-[10px] text-gray-500">{code} · {c.rarity}</div>
                    </div>
                    <div className="text-sm font-bold text-amber-700 tabular-nums">
                      ¥{Math.round(c.now_price).toLocaleString()}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* H2: 主要セット */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-1">主要セット一覧</h2>
        {opTopSets.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-bold mb-2 text-red-700">ワンピカード</h3>
            <div className="flex flex-wrap gap-1.5">
              {opTopSets.map((s) => (
                <Link
                  key={s.set_code}
                  href={`/cards/onepiece/${s.set_code}`}
                  className="text-xs px-2 py-1 rounded border border-red-200 bg-white hover:bg-red-50 text-red-700"
                >
                  {s.set_code}
                  <span className="text-gray-400 ml-1">{s.count}枚</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        {pkmTopSets.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-2 text-yellow-800">ポケカ</h3>
            <div className="flex flex-wrap gap-1.5">
              {pkmTopSets.map((s) => {
                const meta = getPokemonSetMeta(s.set_code);
                return (
                  <Link
                    key={s.set_code}
                    href={`/cards/pokemon/${s.set_code}`}
                    className="text-xs px-2 py-1 rounded border border-yellow-300 bg-white hover:bg-yellow-50 text-yellow-800"
                  >
                    <span className="font-mono">{s.set_code}</span>
                    {meta && <span className="ml-1">{meta.name}</span>}
                    <span className="text-gray-400 ml-1">{s.count}枚</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* H2: データ更新サイクル */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-1">データ更新サイクル</h2>
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-700 space-y-2 leading-relaxed">
          <p>
            <strong>現役の主要セット</strong> (ワンピース最新ブースター、ポケカ MEGA シリーズ最新弾) は <strong>1時間おき</strong> に自動更新されます。
          </p>
          <p>
            <strong>それ以外のセット</strong> (旧ブースター・スターター等) は <strong>1日1回 (深夜帯)</strong> に全件更新。価格推移は<strong>過去90日分</strong>のグラフで表示します。
          </p>
          <p className="text-xs text-gray-500">
            ※ 取扱いサイトのHTML構造変更や一時的な疎通障害で更新が遅れる場合があります。「最終更新時刻」が一定期間古い場合は通常しばらくして自動復旧します。
          </p>
        </div>
      </section>

      {/* H2: 鑑定ツール導線 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-1">関連ツール</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link
            href="/"
            className="block border rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">📸</span>
              <h3 className="font-bold">AI 鑑定 (表裏チェック)</h3>
            </div>
            <p className="text-xs text-gray-600">
              写真をアップでセンタリング・コーナー・エッジ・サーフェスを自動測定。PSA 提出前のセルフチェックに。
            </p>
          </Link>
          <Link
            href="/trending"
            className="block border rounded-lg p-4 hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">📈</span>
              <h3 className="font-bold">値上がりランキング (詳細)</h3>
            </div>
            <p className="text-xs text-gray-600">
              期間・ブランド・価格種別を切り替えて値上がりカードを深掘り。投資判断に。
            </p>
          </Link>
        </div>
      </section>

      {/* H2: FAQ */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-1">よくある質問</h2>
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

function TrendingPanel({
  title,
  items,
  link,
}: {
  title: string;
  items: TrendingCard[];
  link: string;
}) {
  return (
    <div className="border rounded-lg p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">{title}</h3>
        <Link href={link} className="text-xs text-blue-600 hover:underline">
          詳細 →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">データ集計中</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((c, i) => {
            const code = `${c.set_code}-${c.card_no}`;
            const up = c.pct_change >= 0;
            return (
              <li key={c.card_id}>
                <Link
                  href={`/cards/${code}`}
                  className="flex items-center gap-2 text-xs hover:bg-gray-50 rounded px-1 py-0.5"
                >
                  <span className="text-gray-400 w-4 text-center">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{c.name_ja}</span>
                  <span
                    className={`tabular-nums w-12 text-right ${
                      up ? "text-red-600" : "text-blue-600"
                    }`}
                  >
                    {up ? "+" : ""}
                    {c.pct_change.toFixed(0)}%
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
