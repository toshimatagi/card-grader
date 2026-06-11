import Link from "next/link";
import type { Metadata } from "next";
import ShareButtons from "../../../components/share/ShareButtons";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export const metadata: Metadata = {
  title: "PSA10 取得率の実態と提出前にチェックすべき5項目",
  description:
    "PSA10 取得率は実際どのくらい? カードの状態別の確率と、PSA10 を阻害する要因 (センタリング・コーナー・エッジ・サーフェス・ペーパースクラッチ) の見分け方を解説。AI 鑑定でセルフチェックする手順も。",
  keywords: [
    "PSA10 取得率", "PSA10 確率", "PSA10 出ない",
    "PSA鑑定 失敗", "PSA10 セルフチェック",
    "ポケカ PSA10 取得", "ワンピカード PSA10",
    "鑑定提出 失敗パターン", "センタリング 確認",
    "PSA10 基準", "PSA10 取得 コツ",
  ],
  alternates: { canonical: "/guide/psa10-tousenritu" },
  openGraph: {
    title: "PSA10 取得率の実態と提出前にチェックすべき5項目 | TCG Authority",
    description: "PSA10 取得率の現実と、阻害要因の見分け方 + AI 鑑定でセルフチェック",
    url: "/guide/psa10-tousenritu",
    type: "article",
  },
  twitter: { card: "summary_large_image" },
};

const FAQ = [
  {
    q: "PSA10 取得率は平均どのくらいですか?",
    a: "カードの状態と発送方法によって大きく変わります。一般論として、未開封パックから出した直後の状態の良いカードでも PSA10 取得率は 30〜50%、フリマで購入した中古カードは 10〜30%、画像チェックや手当てなしの「適当出し」では 5〜15% 程度というケースもあります。高額カードほど厳しく見られる傾向があり、SAR / SEC など人気バリアントでは 20% 未満ということも珍しくありません。",
  },
  {
    q: "PSA10 を阻害する一番大きい要因は?",
    a: "センタリングです。表裏ともに 50/50 (中央) ± 5% 程度の範囲でないと PSA10 は取得しづらく、特に 60/40 を超えるとほぼ PSA9 止まりです。次にコーナーの白かけ・潰れ、エッジの欠け、サーフェスの細かい傷・印刷ムラ、ペーパースクラッチ (光に当てると見える線状の傷) が続きます。これらは肉眼では見落としがちなので、AI 鑑定で表裏チェックするのがおすすめです。",
  },
  {
    q: "提出する前にどこをチェックすべきですか?",
    a: "(1) 表面センタリング、(2) 裏面センタリング、(3) 4隅の白かけ・潰れ、(4) 4辺のエッジ欠け、(5) サーフェスの傷・指紋・押し跡、の5項目を最低限チェックします。本サイトの AI 鑑定ツールにアップロードすると、(1)(2)(4)(5) は自動測定されます。(3) は実物の目視確認が必要です。",
  },
  {
    q: "高額カードと低額カードで提出戦略は変わりますか?",
    a: "変わります。高額カード (Raw 中央値¥3,000以上) は PSA10 取得時のリターンが大きいので「絶対に PSA10 が出る個体」のみ提出する方針。低額カード (¥1,000未満) は鑑定費用 (¥2,500-) の元が取れない可能性が高いので、Raw 売却 or PSA10 価格が¥10,000以上のカードに絞って提出するのが安全です。本サイトの「Raw→PSA10 倍率TOP」で利幅の出やすいカードを探せます。",
  },
  {
    q: "セルフチェックで PSA10 候補と判断したのに PSA9 になりました。なぜ?",
    a: "AI 鑑定はセンタリング・サーフェス・エッジを画像から推定しますが、(a) 解像度が低い・反射でぶれた画像だと精度が落ちる、(b) ペーパースクラッチや浅い押し跡は光の角度を変えないと見えない、(c) 4隅の極小欠けはピクセル単位なので見落とすことがあります。PSA10 ボーダーラインのカードは複数の照明条件で実物確認することが推奨です。",
  },
  {
    q: "PSA鑑定の費用と期間は?",
    a: "2026年現在、海外直送なら 1枚あたり $25〜$50 (¥3,800〜¥7,500) + 送料、期間 2〜6ヶ月。代行業者経由なら 1枚 ¥3,500〜¥10,000 + 業者手数料、期間 3〜8ヶ月が相場です。Express (急行) は 1枚 $100〜$300 で 1〜2ヶ月。費用と期間は変動するため、提出前に最新情報を確認してください。",
  },
];

export default function GuidePSA10Page() {
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
      { "@type": "ListItem", position: 3, name: "PSA10 取得率", item: `${SITE_URL}/guide/psa10-tousenritu` },
    ],
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "PSA10 取得率の実態と提出前にチェックすべき5項目",
    description:
      "PSA10 取得率の現実と、PSA10 を阻害する要因 (センタリング・コーナー・エッジ・サーフェス) の見分け方を解説",
    author: { "@type": "Organization", name: "TCG Authority" },
    publisher: { "@type": "Organization", name: "TCG Authority", url: SITE_URL },
    datePublished: "2026-05-10",
    url: `${SITE_URL}/guide/psa10-tousenritu`,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/" className="hover:underline">トップ</Link>
        <span className="mx-1.5">/</span>
        <Link href="/guide" className="hover:underline">ガイド</Link>
        <span className="mx-1.5">/</span>
        <span>PSA10 取得率</span>
      </nav>

      <h1 className="text-3xl font-bold mb-3 leading-tight">
        PSA10 取得率の実態と<br className="sm:hidden" />提出前にチェックすべき5項目
      </h1>
      <p className="text-sm text-gray-500 mb-3">
        2026-05-10 公開 ・ TCG Authority
      </p>
      <ShareButtons
        url={`${SITE_URL}/guide/psa10-tousenritu`}
        text="PSA10 取得率の実態と提出前にチェックすべき5項目"
        className="mb-6"
        compact
      />

      <div className="prose prose-sm max-w-none mb-8">
        <p className="text-base leading-relaxed">
          ポケモンカード・ワンピースカードの <strong>PSA10 取得率は実際どれくらい</strong>?
          このページでは、状態別の取得率の目安と、PSA10 を阻害する代表的な要因、
          そして提出前にセルフチェックすべき5項目を解説します。
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">
          1. PSA10 取得率の現実
        </h2>
        <p className="text-sm leading-relaxed mb-3">
          「カードショップで美品と表記されていれば PSA10 が出る」というのは誤解です。
          PSA10 (Gem Mint) は表裏のセンタリング・コーナー・エッジ・サーフェスのすべてが
          ほぼ完璧であることを要求するため、実際の取得率は次のような分布になります。
        </p>
        <table className="w-full text-sm border-collapse mb-4">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="border p-2">カードの状態</th>
              <th className="border p-2 text-right">PSA10 取得率の目安</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="border p-2">未開封パックから出した直後・厳選・スリーブ即収納</td><td className="border p-2 text-right">30〜50%</td></tr>
            <tr><td className="border p-2">プレイヤーズエディションの新品・状態厳選</td><td className="border p-2 text-right">20〜35%</td></tr>
            <tr><td className="border p-2">フリマ購入の「美品」表記カード</td><td className="border p-2 text-right">10〜25%</td></tr>
            <tr><td className="border p-2">手元保管カード (画像チェックなし)</td><td className="border p-2 text-right">5〜15%</td></tr>
            <tr><td className="border p-2">「PSA10候補」とされた厳選個体</td><td className="border p-2 text-right">40〜70%</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-500">
          ※ カードのレアリティ (SAR / SEC 等の高額版は厳しく見られる) と発送中の梱包品質によっても変動します。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">
          2. PSA10 を阻害する要因 (5大要素)
        </h2>
        <ol className="space-y-3 text-sm leading-relaxed">
          <li>
            <strong>① センタリング</strong> — 印刷フレームがカードの中央にあるか。表裏それぞれ ±5% (50/50 ± 5%) が目安。60/40 を超えるとほぼ PSA9 止まり。これだけで 50% のカードがふるい落とされます。
          </li>
          <li>
            <strong>② コーナー (4隅)</strong> — 白かけ (色の剥がれ)・潰れ・反り・押し跡。光の反射で確認。1mm の白かけでも PSA10 を逃します。スリーブ未着のまま運搬すると最も傷みやすい部位。
          </li>
          <li>
            <strong>③ エッジ (4辺)</strong> — 縁の欠け・摩耗・色剥がれ。ボックスから取り出す際に最も摩耗します。光に透かして確認。
          </li>
          <li>
            <strong>④ サーフェス (表裏面)</strong> — 印刷ムラ・指紋・引っかき傷・押し跡・ペーパースクラッチ (光に当てると見える線状の傷)。最も見落としやすい。明るい LED の下で角度を変えながら確認。
          </li>
          <li>
            <strong>⑤ レジストレーション (印刷ズレ)</strong> — カードの印刷フレームが裏側のものと表で対称か。これは個体差で、流通段階では避けられません。
          </li>
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">
          3. 提出前にセルフチェックすべき5項目
        </h2>
        <p className="text-sm mb-3">
          ボーダーラインのカードを提出して鑑定費用を浪費しないため、
          以下5項目を必ずチェックしてください。
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm leading-relaxed">
          <li><strong>表面センタリング</strong> (左右比 / 上下比をピクセル単位で)</li>
          <li><strong>裏面センタリング</strong> (表裏のうち悪い方の数値が PSA グレードに採用される)</li>
          <li><strong>4隅の白かけ・潰れ</strong> (拡大鏡 or スマホズーム + LED)</li>
          <li><strong>4辺のエッジ欠け</strong> (光に透かす)</li>
          <li><strong>サーフェスの傷・指紋・押し跡</strong> (反射光の角度を変えながら)</li>
        </ol>
        <p className="text-sm mt-4 leading-relaxed">
          (1)(2)(4)(5) は本サイトの <Link href="/" className="text-blue-700 hover:underline font-bold">AI 鑑定ツール</Link>{" "}
          で表面・裏面の写真をアップロードすれば自動測定されます。総合スコア 9.5 以上なら PSA10 候補、
          8.5〜9.4 なら PSA9 候補という目安です。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">
          4. 提出前に検討すべき経済性
        </h2>
        <p className="text-sm leading-relaxed mb-3">
          PSA鑑定費用は 1枚あたり ¥3,500〜¥10,000 (代行業者) または $25〜$50 (海外直送) +送料。
          つまり PSA10 と Raw の価格差が <strong>¥5,000 以上ない</strong>と提出の経済合理性がありません。
        </p>
        <p className="text-sm leading-relaxed mb-3">
          鑑定提出で利幅が出やすいカードは:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Raw → PSA10 で<strong>10倍以上</strong>に跳ねるカード</li>
          <li>PSA10 中央値が <strong>¥10,000 以上</strong></li>
          <li>状態の良い個体を選別しやすいカード</li>
        </ul>
        <p className="text-sm mt-3 leading-relaxed">
          <Link href="/trending/spread" className="text-emerald-700 hover:underline font-bold">
            Raw→PSA10 倍率TOP ランキング
          </Link>
          {" "}で、現時点で利幅の出やすいカード一覧を確認できます。
        </p>
      </section>

      <section className="mb-8 border-t pt-6">
        <h2 className="text-xl font-bold mb-3">よくある質問 (FAQ)</h2>
        <dl className="space-y-4 text-sm">
          {FAQ.map((f, i) => (
            <div key={i}>
              <dt className="font-bold text-gray-800">Q. {f.q}</dt>
              <dd className="text-gray-700 mt-1 leading-relaxed">A. {f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8 p-4 rounded-lg bg-blue-50 border border-blue-200">
        <h3 className="font-bold text-blue-900 mb-2">関連リンク</h3>
        <ul className="space-y-1 text-sm">
          <li>→ <Link href="/" className="text-blue-700 hover:underline">AI 鑑定ツール (表裏チェック)</Link></li>
          <li>→ <Link href="/trending/psa10" className="text-blue-700 hover:underline">PSA10 高額カード TOP100</Link></li>
          <li>→ <Link href="/trending/spread" className="text-blue-700 hover:underline">Raw → PSA10 倍率TOP (鑑定で旨味あるカード)</Link></li>
          <li>→ <Link href="/guide/kantei-teisyutsu" className="text-blue-700 hover:underline">鑑定提出 完全マニュアル (PSA / BGS の選び方)</Link></li>
          <li>→ <Link href="/guide/mercari-takaku-uru" className="text-blue-700 hover:underline">メルカリで高く売るコツ</Link></li>
        </ul>
      </section>
    </article>
  );
}
