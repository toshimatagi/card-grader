import Link from "next/link";
import type { Metadata } from "next";
import ShareButtons from "../../../components/share/ShareButtons";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export const metadata: Metadata = {
  title: "メルカリでカードを高く売るコツ — タイトル / 写真 / 価格設定の正解",
  description:
    "ポケカ・ワンピカードをメルカリで高く売るための実践テクニック。タイトル付け方・写真の撮り方・価格設定・出品タイミングを徹底解説。Raw / PSA10 別の戦略付き。",
  keywords: [
    "メルカリ ポケカ 売る", "メルカリ ワンピカード 売る",
    "メルカリ 高く売る", "メルカリ タイトル コツ",
    "メルカリ 写真 撮り方", "メルカリ 価格設定",
    "PSA10 売る メルカリ", "Raw 売る",
    "ポケカ フリマ", "カード フリマ 売却",
  ],
  alternates: { canonical: "/guide/mercari-takaku-uru" },
  openGraph: {
    title: "メルカリでカードを高く売るコツ | TCG Authority",
    description: "タイトル・写真・価格設定の実践テクニック",
    url: "/guide/mercari-takaku-uru",
    type: "article",
  },
  twitter: { card: "summary_large_image" },
};

const FAQ = [
  {
    q: "メルカリ・Yahoo オークション・カードショップ買取、どこが一番高く売れますか?",
    a: "PSA10 鑑定済みカードは Yahoo オークション (落札価格が透明、PSA10 専門の入札者が多い) が最高値。Raw (未鑑定) はメルカリが多い (購入者層が広い、即決価格設定可能)。短期で確実に現金化したいなら専門店買取 (中央値の 60〜80% 程度)。本サイトの中央値は通常メルカリ・Yahoo オークションの実成約価格を反映しています。",
  },
  {
    q: "メルカリのタイトルで意識すべきことは?",
    a: "(1) カード名 + 型番 + レアリティを必ず含める (例: 「ピカチュウex M02A-044 RR ポケカ」)、(2) PSA / BGS 鑑定済みなら必ず明記 + グレード番号、(3) 状態キーワード (新品同様/美品/プレイ用) を含める、(4) シリーズ名 (ポケモンカード / ワンピース TCG) を含める (検索ヒット率向上)。タイトル40文字制限なので「ポケカ」「ワンピ」など短縮形も活用。",
  },
  {
    q: "写真は何枚撮るべき?",
    a: "最低4枚: 表面全体・裏面全体・4隅の拡大 (反射光での状態確認)・スリーブ収納状態。理想は 7〜10枚で、(5) 上下左右のエッジ拡大、(6) 印刷ズレ確認、(7) 鑑定済みならスラブの角度違いカット。明るい LED 下で撮影、影ができないように、できれば白色の背景で。",
  },
  {
    q: "価格はどう設定すべきですか?",
    a: "本サイトの該当カードページで Raw / PSA10 の中央値を確認。メルカリで売るなら中央値より 5〜10% 上 (販売手数料 10% を考慮) が目安。早く売りたいなら中央値ジャストか若干下、最高値を狙うなら +15〜20% で出して値下げ交渉に応じる戦略。中央値より大きく外すと購入者が来ません。",
  },
  {
    q: "出品タイミングは効きますか?",
    a: "メルカリは「新着上位」効果が大きいので 21〜23時 (メルカリのアクティブユーザー最多時間帯) の出品が定石。週末 (土日夜) は購入者層が広いので競争激しいが成約率も高い。トレンド系イベント (新弾発売直後・大会開催前) はトレンドカードが集中して売れるタイミング。",
  },
  {
    q: "メルカリで送る時の梱包は?",
    a: "Raw カード: ペニースリーブ + ハードスリーブ + ダンボール A4 サイズに入れて「折り曲げ厳禁」「水濡れ防止」シール。¥1,000以下のカードはらくらくメルカリ便のネコポス (¥210)。¥3,000以上は宅配便コンパクト (¥450) 推奨。PSA鑑定済み: マグネットケースに入れて段ボール二重梱包、補償付き宅急便を選択。",
  },
  {
    q: "値下げ交渉はどう対応すべき?",
    a: "(1) 出品価格に+15〜20% のマージンを最初から含めておくと値下げ交渉に応じやすい。(2) 中央値以下への値下げは避ける (値下げの連鎖を招く)。(3) 「専用」依頼は要注意 (キャンセル率が高い)。(4) 質問対応の早さが信頼度に直結、24時間以内の返信を心がける。",
  },
];

export default function GuideMercari() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "使い方ガイド", item: `${SITE_URL}/guide` },
      { "@type": "ListItem", position: 3, name: "メルカリ高額売却術", item: `${SITE_URL}/guide/mercari-takaku-uru` },
    ],
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "メルカリでカードを高く売るコツ",
    description: "ポケカ・ワンピカードをメルカリで高く売るタイトル・写真・価格設定の実践テクニック",
    author: { "@type": "Organization", name: "TCG Authority" },
    publisher: { "@type": "Organization", name: "TCG Authority", url: SITE_URL },
    datePublished: "2026-05-10",
    url: `${SITE_URL}/guide/mercari-takaku-uru`,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />

      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/" className="hover:underline">トップ</Link>
        <span className="mx-1.5">/</span>
        <Link href="/guide" className="hover:underline">ガイド</Link>
        <span className="mx-1.5">/</span>
        <span>メルカリで高く売るコツ</span>
      </nav>

      <h1 className="text-3xl font-bold mb-3 leading-tight">
        メルカリでカードを高く売るコツ<br className="sm:hidden" />
        <span className="text-xl text-gray-700">タイトル・写真・価格設定の実践テクニック</span>
      </h1>
      <p className="text-sm text-gray-500 mb-3">2026-05-10 公開 ・ TCG Authority</p>
      <ShareButtons
        url={`${SITE_URL}/guide/mercari-takaku-uru`}
        text="メルカリでカードを高く売るコツ — タイトル・写真・価格設定の正解"
        className="mb-6"
        compact
      />

      <div className="prose prose-sm max-w-none mb-8">
        <p className="text-base leading-relaxed">
          ポケモンカード・ワンピースカードを <strong>メルカリで高く売る</strong> ための実践テクニックを集約。
          タイトル付け・写真撮影・価格設定・出品タイミング・梱包の全ステップを、
          Raw (未鑑定) / PSA10 鑑定済みの戦略別に解説します。
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">1. タイトル: 検索ヒットさせる構造</h2>
        <p className="text-sm leading-relaxed mb-3">
          メルカリの検索アルゴリズムはタイトル一致を最重視します。以下の要素を含めるとヒット率が大きく向上します。
        </p>
        <div className="bg-gray-50 p-3 rounded text-sm mb-3 font-mono">
          【良い例】<br/>
          ピカチュウex M02A-044 RR ポケカ ポケモンカード 美品<br/>
          <br/>
          【良い例 (PSA鑑定済)】<br/>
          PSA10 メガカイリューex M02A-126 RR ポケカ
        </div>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>カード名</strong> (フリガナ含めると尚良し)</li>
          <li><strong>型番</strong> (例: M02A-126 / OP15-007)</li>
          <li><strong>レアリティ</strong> (RR / SR / SAR / SEC など)</li>
          <li><strong>シリーズ名</strong> (ポケカ・ポケモンカード・ワンピカード・ワンピTCG)</li>
          <li><strong>鑑定情報</strong> (PSA10 / BGS9.5 など)</li>
          <li><strong>状態キーワード</strong> (新品同様 / 美品 / プレイ用)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">2. 写真: 信頼度を上げる撮影</h2>
        <p className="text-sm leading-relaxed mb-3">
          メルカリでは「写真が悪い」=「状態が悪い」と判断されて値下げ要求が来ます。最低4枚、理想は8枚以上を確保してください。
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li><strong>表面全体</strong> (高解像度、影なし、白背景)</li>
          <li><strong>裏面全体</strong> (センタリング確認用)</li>
          <li><strong>4隅の拡大</strong> (反射光で状態を見せる、各1枚で計4枚)</li>
          <li><strong>4辺のエッジ</strong> (光に透かし、欠けがないことを示す)</li>
          <li><strong>スリーブ収納状態</strong> (発送時の保管がしっかりしていることをアピール)</li>
          <li><strong>鑑定スラブの角度違い</strong> (PSA/BGS の場合)</li>
        </ol>
        <p className="text-sm mt-3 leading-relaxed">
          撮影前に <Link href="/" className="text-blue-700 hover:underline font-bold">AI 鑑定ツール</Link>で表裏の状態確認をしておくと、出品文に「センタリング○○%」などの定量情報を書けて信頼度が上がります。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">3. 価格設定: 中央値ベースの戦略</h2>
        <p className="text-sm leading-relaxed mb-3">
          本サイトの該当カードページで現在の中央値を確認し、戦略に応じて設定してください。
        </p>
        <table className="w-full text-sm border-collapse mb-3">
          <thead><tr className="bg-gray-100 text-left"><th className="border p-2">戦略</th><th className="border p-2">価格設定</th><th className="border p-2">期待される結果</th></tr></thead>
          <tbody>
            <tr><td className="border p-2 font-medium">最速売却</td><td className="border p-2">中央値 -5%</td><td className="border p-2">数時間で売却</td></tr>
            <tr><td className="border p-2 font-medium">標準</td><td className="border p-2">中央値 +5〜10%</td><td className="border p-2">数日で売却</td></tr>
            <tr><td className="border p-2 font-medium">最高値狙い</td><td className="border p-2">中央値 +15〜20%</td><td className="border p-2">2〜4週間 / 値下げ交渉前提</td></tr>
            <tr><td className="border p-2 font-medium">高額カード ($100+)</td><td className="border p-2">中央値 +10%</td><td className="border p-2">慎重買主向け、コメント対応必須</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-600">※ メルカリ販売手数料は 10%、振込手数料 ¥210 を考慮。¥10,000 のカードを中央値で売ると手取り ¥8,790。</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">4. 出品タイミング</h2>
        <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
          <li><strong>21〜23時</strong> がメルカリのアクティブユーザー最多時間帯。新着上位効果で表示回数が伸びる</li>
          <li><strong>金曜・土曜・日曜の夜</strong> は購入者層が最も広い</li>
          <li><strong>新弾発売直後 (1-2週間)</strong> は需要ピーク。新弾 SAR・SEC は強気価格でも売れる</li>
          <li><strong>大会開催前後</strong> は対戦で使われるカード需要が上昇</li>
          <li><strong>給料日 (25日付近)</strong> は高額カードが動きやすい</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">5. 梱包・発送 (トラブル防止)</h2>
        <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
          <li>ペニースリーブ + ハードスリーブ (UltraPro / KMC) の二重</li>
          <li>厚紙 (Card Saver IV) で挟む</li>
          <li>OPP袋で水濡れ防止</li>
          <li>段ボール A4 (またはダンボール梱包資材) で折り曲げ防止</li>
          <li>「折曲厳禁」「水濡れ防止」シール</li>
          <li>送料込みで出品 (送料別だと検索順位下がる傾向)</li>
          <li>¥1,000以下: ネコポス ¥210 / らくらくメルカリ便 ¥250</li>
          <li>¥3,000以上: 宅配便コンパクト ¥450 (補償あり)</li>
          <li>¥10,000以上: 宅急便 (補償 ¥30万まで)</li>
        </ul>
      </section>

      <section className="mb-8 border-t pt-6">
        <h2 className="text-xl font-bold mb-3">よくある質問</h2>
        <dl className="space-y-4 text-sm">
          {FAQ.map((f, i) => (
            <div key={i}>
              <dt className="font-bold text-gray-800">Q. {f.q}</dt>
              <dd className="text-gray-700 mt-1 leading-relaxed">A. {f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
        <h3 className="font-bold text-emerald-900 mb-2">関連リンク</h3>
        <ul className="space-y-1 text-sm">
          <li>→ <Link href="/cards" className="text-emerald-800 hover:underline">価格DB (相場確認)</Link></li>
          <li>→ <Link href="/" className="text-emerald-800 hover:underline">AI 鑑定ツール (出品前のセルフチェック)</Link></li>
          <li>→ <Link href="/guide/psa10-tousenritu" className="text-emerald-800 hover:underline">PSA10 取得率と提出前チェック5項目</Link></li>
          <li>→ <Link href="/guide/kantei-teisyutsu" className="text-emerald-800 hover:underline">鑑定提出 完全マニュアル</Link></li>
          <li>→ <Link href="/trending/psa10" className="text-emerald-800 hover:underline">PSA10 高額カード TOP100</Link></li>
        </ul>
      </section>
    </article>
  );
}
