import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description:
    "TCG Authority へのお問い合わせ・要望・データ修正依頼・著作権関連連絡など。GitHub Issues またはメールで受け付け。",
  alternates: { canonical: "/contact" },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <article className="max-w-3xl mx-auto prose prose-sm">
      <nav className="text-xs text-gray-500 mb-2 not-prose">
        <Link href="/" className="hover:underline">トップ</Link>
        <span className="mx-1.5">/</span>
        <span>お問い合わせ</span>
      </nav>

      <h1 className="text-2xl font-bold mb-2">お問い合わせ</h1>
      <p>
        TCG Authority へのご連絡は、内容に応じて以下の方法でお願いいたします。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">バグ報告・機能要望</h2>
      <p>
        サイトの不具合・改善提案・新機能要望は、GitHub Issues にて受け付けています。
        スクリーンショットや再現手順を添えていただけると対応がスムーズです。
      </p>
      <p>
        →{" "}
        <a
          href="https://github.com/toshimatagi/card-grader/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 hover:underline"
        >
          GitHub Issues (toshimatagi/card-grader)
        </a>
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">価格データの修正依頼</h2>
      <p>
        カード相場・型番・カード名などの誤りを発見された場合、以下の情報を添えて
        メールにてご連絡ください。
      </p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>該当カードの URL (例: https://tcg-authority.com/cards/M02A-126)</li>
        <li>誤っている内容と正しい内容</li>
        <li>参考にされたソース (任意、修正の根拠となるもの)</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">著作権・商標に関するお問い合わせ</h2>
      <p>
        本サイトに掲載されているカード画像・カード名等の権利者の方からの
        削除依頼・利用条件等のご連絡は、優先的に対応いたします。
        以下の情報をメールにてご送付ください。
      </p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>権利者であることが確認できる情報 (会社名、担当部署、ご担当者名)</li>
        <li>該当する URL またはページ</li>
        <li>具体的なご要望 (削除、修正、ライセンス等)</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">プライバシー・個人情報に関するお問い合わせ</h2>
      <p>
        AI 鑑定でアップロードされた画像の削除依頼、個人情報の開示・訂正・削除依頼は
        メールにて受け付けます。本人確認のため、追加情報をお伺いする場合があります。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">主な連絡方法</h2>
      <p>
        現在、お問い合わせは
        <strong>
          {" "}<a
            href="https://github.com/toshimatagi/card-grader/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline"
          >
            GitHub Issues
          </a>{" "}
        </strong>
        を主要窓口として運用しています。GitHub アカウントをお持ちの方はそちらからご連絡ください。
      </p>
      <p>
        GitHub をお使いでない方や、著作権関連・プライバシー関連のセンシティブな
        ご連絡については、専用メールフォームを準備中です。それまでの間は GitHub
        Issues にて「general」「private」等のラベルを付けてご連絡ください。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">対応外のお問い合わせ</h2>
      <p>以下のご連絡については対応いたしかねますのでご了承ください。</p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>個別のカード売買仲介・鑑定代行</li>
        <li>取引相場の保証要請、損害賠償請求</li>
        <li>営業・宣伝・SEO 業務委託の提案</li>
        <li>本サイトの売却・買収提案 (現時点で予定なし)</li>
      </ul>

      <p className="text-xs text-gray-500 mt-8">© TCG Authority</p>
    </article>
  );
}
