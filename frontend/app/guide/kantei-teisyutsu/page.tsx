import Link from "next/link";
import type { Metadata } from "next";
import ShareButtons from "../../../components/share/ShareButtons";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export const metadata: Metadata = {
  title: "鑑定提出 完全マニュアル — PSA / BGS の選び方と提出ステップ",
  description:
    "PSA・BGS への鑑定提出方法を徹底解説。海外直送 vs 代行業者の比較、費用・期間、ラベル種類 (Standard / Express)、提出失敗パターンと回避策。初心者向け完全ガイド。",
  keywords: [
    "PSA 鑑定 提出方法", "BGS 鑑定", "鑑定 海外直送",
    "PSA 代行業者", "PSA 費用", "PSA 期間",
    "鑑定 出し方", "ポケカ 鑑定 出し方", "ワンピカード 鑑定",
    "PSA Express", "PSA Standard", "鑑定 失敗",
  ],
  alternates: { canonical: "/guide/kantei-teisyutsu" },
  openGraph: {
    title: "鑑定提出 完全マニュアル | TCG Authority",
    description: "PSA / BGS の選び方・費用・期間・提出ステップを徹底解説",
    url: "/guide/kantei-teisyutsu",
    type: "article",
  },
  twitter: { card: "summary_large_image" },
};

const FAQ = [
  {
    q: "PSA と BGS どちらに出すべきですか?",
    a: "市場流通量・知名度で PSA が圧倒的に有利。日本で売却するなら PSA10 が圧倒的に高値で取引されます (BGS10 は同価格〜やや安いことが多い)。BGS は4要素サブグレード (Centering/Corners/Edges/Surface 各1〜10) が表記されるため、長期保有・コレクション目的なら BGS、短期売却なら PSA というのが定石。",
  },
  {
    q: "海外直送と代行業者、どっちが得?",
    a: "費用面では海外直送の方が 30〜50% 安いですが、英語フォーム記入・国際送料・税関対応が必要。トラブル時の対応も自己責任。代行業者経由は費用が上乗せされるものの、日本語サポート・梱包代行・トラッキング・トラブル時の補償あり。年間 5枚以上提出するなら直送、1〜3枚なら代行業者が安心です。",
  },
  {
    q: "鑑定費用と期間はどのくらい?",
    a: "PSA 海外直送: $25〜$50 (¥3,800〜¥7,500)/枚 + 送料 ¥3,000〜¥8,000、期間 2〜6ヶ月。代行業者: ¥3,500〜¥10,000/枚 + 業者手数料、期間 3〜8ヶ月。Express (急行) なら $100〜$300/枚で 1〜2ヶ月。BGS は若干高め。費用と期間は時期により大きく変動します。",
  },
  {
    q: "鑑定で失敗するパターンは?",
    a: "(1) 状態確認なしの「適当出し」で PSA9 以下しか出ず費用倒れ、(2) 同梱中の事故 (スリーブで擦れて新たに傷がつく)、(3) 高額カードを Standard 便で出して紛失リスク、(4) 期間中に相場が下がって含み益消失、(5) 偽造・改造扱いで返却不可。事前に AI 鑑定でセルフチェックし、PSA10 ボーダーラインのカードは Raw 売却の方が安全な場合もあります。",
  },
  {
    q: "提出前にカードはどう保護すべき?",
    a: "カードセイバー (Card Saver) などの硬質スリーブに入れ、ペニースリーブ→トップローダーまたはマグネットケースで保護。指紋を残さないため手袋着用 or カード本体に触れないこと。発送時は防湿剤 + 段ボール + プチプチで二重梱包。海外発送は EMS で追跡を必須に。",
  },
  {
    q: "Express 鑑定はいつ使うべき?",
    a: "(1) 値上がりトレンドが続いていて早く市場に出したいカード、(2) 高額カード ($1000以上) で資金回転を上げたい場合、(3) イベント (世界大会前後など) に合わせたい場合。費用が3〜10倍になるので、PSA10 価格の上昇期待値が費用増分を上回るときのみ採算が取れます。",
  },
  {
    q: "鑑定後の売却はどこが良いですか?",
    a: "PSA10 は Yahoo オークション (落札相場が透明)・メルカリ (購入者層が広い)・カードショップ買取 (即金) が定番。値段は Yahoo オークション>メルカリ>カードショップ買取の順。本サイトの PSA10 高額TOP に近いカードは Yahoo オークションが最も期待値高め。",
  },
];

export default function GuideKanteiTeisyutsu() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "鑑定提出 完全マニュアル — PSA / BGS の選び方と提出ステップ",
    description: "PSA・BGS への鑑定提出方法、費用・期間・失敗パターンを徹底解説",
    author: { "@type": "Organization", name: "TCG Authority" },
    publisher: { "@type": "Organization", name: "TCG Authority", url: SITE_URL },
    datePublished: "2026-05-10",
    url: `${SITE_URL}/guide/kantei-teisyutsu`,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />

      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/" className="hover:underline">トップ</Link>
        <span className="mx-1.5">/</span>
        <Link href="/guide" className="hover:underline">ガイド</Link>
        <span className="mx-1.5">/</span>
        <span>鑑定提出マニュアル</span>
      </nav>

      <h1 className="text-3xl font-bold mb-3 leading-tight">
        鑑定提出 完全マニュアル<br className="sm:hidden" />
        <span className="text-xl text-gray-700">PSA / BGS の選び方と提出ステップ</span>
      </h1>
      <p className="text-sm text-gray-500 mb-3">2026-05-10 公開 ・ TCG Authority</p>
      <ShareButtons
        url={`${SITE_URL}/guide/kantei-teisyutsu`}
        text="鑑定提出 完全マニュアル — PSA / BGS の選び方"
        className="mb-6"
        compact
      />

      <div className="prose prose-sm max-w-none mb-8">
        <p className="text-base leading-relaxed">
          ポケカ・ワンピカードを <strong>PSA / BGS で鑑定提出する全ステップ</strong> を解説。
          海外直送 vs 代行業者の比較、費用・期間・失敗パターン・梱包方法まで、
          初めての提出でも失敗しないためのチェックリスト形式でお届けします。
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">1. PSA か BGS か</h2>
        <table className="w-full text-sm border-collapse mb-3">
          <thead><tr className="bg-gray-100 text-left"><th className="border p-2">項目</th><th className="border p-2">PSA</th><th className="border p-2">BGS</th></tr></thead>
          <tbody>
            <tr><td className="border p-2 font-medium">市場流通量</td><td className="border p-2">圧倒的に多い</td><td className="border p-2">少ない</td></tr>
            <tr><td className="border p-2 font-medium">日本での認知度</td><td className="border p-2">非常に高い</td><td className="border p-2">中</td></tr>
            <tr><td className="border p-2 font-medium">PSA10/BGS10 の価格</td><td className="border p-2">高い (基準)</td><td className="border p-2">PSA10 と同等〜やや安</td></tr>
            <tr><td className="border p-2 font-medium">サブグレード</td><td className="border p-2">なし</td><td className="border p-2">4要素表記 (C/Cr/E/S)</td></tr>
            <tr><td className="border p-2 font-medium">グレード厳しさ</td><td className="border p-2">中</td><td className="border p-2">PSA より厳しめ (BGS9.5 = PSA10 相当)</td></tr>
          </tbody>
        </table>
        <p className="text-sm leading-relaxed">
          短期売却なら <strong>PSA</strong>、長期保有・コレクション目的・サブグレード重視なら <strong>BGS</strong> が定番。日本市場では PSA が圧倒的優位なので、迷ったら PSA を選んでおけば失敗しません。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">2. 海外直送 vs 代行業者</h2>
        <table className="w-full text-sm border-collapse mb-3">
          <thead><tr className="bg-gray-100 text-left"><th className="border p-2"></th><th className="border p-2">海外直送</th><th className="border p-2">代行業者</th></tr></thead>
          <tbody>
            <tr><td className="border p-2 font-medium">費用</td><td className="border p-2">$25〜$50/枚</td><td className="border p-2">¥3,500〜¥10,000/枚</td></tr>
            <tr><td className="border p-2 font-medium">期間</td><td className="border p-2">2〜6ヶ月</td><td className="border p-2">3〜8ヶ月</td></tr>
            <tr><td className="border p-2 font-medium">手間</td><td className="border p-2">英語フォーム / 税関 / 国際送料</td><td className="border p-2">梱包から発送まで全代行</td></tr>
            <tr><td className="border p-2 font-medium">トラブル対応</td><td className="border p-2">自己責任</td><td className="border p-2">日本語サポートあり</td></tr>
            <tr><td className="border p-2 font-medium">向いてる人</td><td className="border p-2">年5枚以上提出する常連</td><td className="border p-2">年1〜3枚の初心者</td></tr>
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">3. 提出ステップ (代行業者経由 / 推奨)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm leading-relaxed">
          <li><strong>カード選定</strong> — Raw 中央値¥3,000以上 + PSA10 中央値が Raw の 5倍以上のカードを優先。<Link href="/trending/spread" className="text-blue-700 hover:underline">倍率TOP</Link>を参考に</li>
          <li><strong>セルフチェック</strong> — <Link href="/" className="text-blue-700 hover:underline">AI 鑑定ツール</Link>で総合スコア 9.0 以上の個体のみ通過させる</li>
          <li><strong>申し込み</strong> — 代行業者の Web フォームから申込 (枚数・サービス便種・住所)</li>
          <li><strong>梱包</strong> — Card Saver IV → ペニースリーブ → 防湿剤 → 段ボール (角を保護)</li>
          <li><strong>発送</strong> — 日本郵便または宅配便で代行業者の集荷拠点へ。複数枚は分割して保険を分散</li>
          <li><strong>進捗確認</strong> — 業者経由で PSA の Order Status を確認 (Received → Research → Grading → Quality Check → Shipped)</li>
          <li><strong>受領後の処理</strong> — 開封時に動画撮影 (万一の差し替えクレーム対策)、グレード確認</li>
          <li><strong>売却</strong> — Yahoo オークション or メルカリ。<Link href="/guide/mercari-takaku-uru" className="text-blue-700 hover:underline">高く売るコツ</Link>を参照</li>
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-3">4. 失敗を避ける5つの注意点</h2>
        <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed">
          <li><strong>「PSA10 ボーダーラインのカードは出さない」</strong> — AI鑑定で 9.5 未満のカードは Raw 売却が安全</li>
          <li><strong>梱包中に新たな傷をつけない</strong> — スリーブ着脱は最小限に、机の上で行う</li>
          <li><strong>高額カード ($1,000+) は Express 推奨</strong> — Standard だと紛失リスクが Standard の方が高い (補償額制限)</li>
          <li><strong>提出中に相場急落のリスク</strong> — 鑑定中の数ヶ月で値下がりすると含み益消失。トレンドが上昇中のカードを優先</li>
          <li><strong>偽造・改造扱いの返却に注意</strong> — リプロ・印刷ズレ過大は鑑定不可で返却。明らかにおかしいカードは出さない</li>
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

      <section className="mt-8 p-4 rounded-lg bg-amber-50 border border-amber-200">
        <h3 className="font-bold text-amber-900 mb-2">関連リンク</h3>
        <ul className="space-y-1 text-sm">
          <li>→ <Link href="/" className="text-amber-800 hover:underline">AI 鑑定ツール (提出前のセルフチェック)</Link></li>
          <li>→ <Link href="/guide/psa10-tousenritu" className="text-amber-800 hover:underline">PSA10 取得率の実態と提出前チェック5項目</Link></li>
          <li>→ <Link href="/guide/mercari-takaku-uru" className="text-amber-800 hover:underline">メルカリで高く売るコツ</Link></li>
          <li>→ <Link href="/trending/spread" className="text-amber-800 hover:underline">Raw → PSA10 倍率TOP</Link></li>
          <li>→ <Link href="/trending/psa10" className="text-amber-800 hover:underline">PSA10 高額カード TOP100</Link></li>
        </ul>
      </section>
    </article>
  );
}
