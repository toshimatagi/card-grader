import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "TCG Authority のプライバシーポリシー。アクセス解析・広告配信・Cookie の取り扱い、第三者配信サービスの利用、ユーザーの権利について。",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

const UPDATED_AT = "2026-05-10";

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl mx-auto prose prose-sm">
      <nav className="text-xs text-gray-500 mb-2 not-prose">
        <Link href="/" className="hover:underline">トップ</Link>
        <span className="mx-1.5">/</span>
        <span>プライバシーポリシー</span>
      </nav>

      <h1 className="text-2xl font-bold mb-2">プライバシーポリシー</h1>
      <p className="text-xs text-gray-500 mb-6">最終更新: {UPDATED_AT}</p>

      <p>
        TCG Authority (https://tcg-authority.com、以下「本サイト」)
        における個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">1. 取得する情報</h2>
      <p>本サイトでは以下の情報を取得することがあります。</p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>アクセスログ (IPアドレス、ブラウザ種別、参照元URL、アクセス日時)</li>
        <li>Cookie および同様の技術により収集される識別子</li>
        <li>AI鑑定機能でユーザーがアップロードしたカード画像 (鑑定結果生成および履歴表示のため)</li>
        <li>お問い合わせフォーム経由でユーザーが任意に提供する情報 (メールアドレス、内容)</li>
        <li>
          Googleログイン (アカウント作成) 時に Google から受け渡される識別子・メールアドレス。
          コレクション管理機能のユーザー識別目的のみに使用し、メールアドレスは UI 上に表示せず、
          第三者提供・広告利用も行いません。氏名・プロフィール画像は本サイト側では保存しません。
        </li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">2. 利用目的</h2>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>サービスの提供・運用・改善</li>
        <li>アクセス解析によるサイト品質向上</li>
        <li>広告配信の最適化</li>
        <li>不正アクセス・スパム対策</li>
        <li>お問い合わせへの返信</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">3. アクセス解析ツール</h2>
      <p>
        本サイトは Google LLC が提供する「Google Analytics 4」を利用してアクセス状況を分析しています。
        Google Analytics は Cookie を使用してユーザーを識別しますが、個人を特定する情報は取得しません。
      </p>
      <p className="text-xs text-gray-600">
        Google Analytics 規約:{" "}
        <a
          href="https://marketingplatform.google.com/about/analytics/terms/jp/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 hover:underline"
        >
          https://marketingplatform.google.com/about/analytics/terms/jp/
        </a>
      </p>
      <p className="text-xs text-gray-600 mt-2">
        オプトアウト: 以下の Google アナリティクスオプトアウトアドオンをインストールすることで、
        Google Analytics による情報収集を無効化できます。
        <br />
        <a
          href="https://tools.google.com/dlpage/gaoptout?hl=ja"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 hover:underline"
        >
          https://tools.google.com/dlpage/gaoptout?hl=ja
        </a>
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">4. 広告配信について</h2>
      <p>
        本サイトは Google LLC が提供する第三者配信の広告サービス「Google AdSense」を利用する場合があります。
        Google などの第三者配信事業者は、Cookie を使用してユーザーの過去のアクセス情報に基づいて広告を配信します。
      </p>
      <p>
        Google が広告 Cookie を使用することにより、本サイトおよび他のサイトへのアクセス情報に基づいた広告を配信します。
      </p>
      <p className="text-xs text-gray-600">
        広告のパーソナライズの無効化:{" "}
        <a
          href="https://www.google.com/settings/ads"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 hover:underline"
        >
          https://www.google.com/settings/ads
        </a>
      </p>
      <p className="text-xs text-gray-600">
        Google 広告ポリシー:{" "}
        <a
          href="https://policies.google.com/technologies/ads?hl=ja"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 hover:underline"
        >
          https://policies.google.com/technologies/ads?hl=ja
        </a>
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">5. 第三者サービスへのデータ送信</h2>
      <p>本サイトは以下の第三者サービスを利用しており、それぞれの目的で必要なデータを送信することがあります。</p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li><strong>Vercel Inc.</strong> — 本サイトのホスティングおよび CDN 配信</li>
        <li><strong>Supabase Inc.</strong> — 価格データベースおよび鑑定履歴の保管</li>
        <li><strong>Google LLC</strong> — Google Analytics、Google AdSense、Google Tag Manager</li>
        <li><strong>Render</strong> — AI 鑑定 API の実行環境</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">6. アップロード画像の取り扱い</h2>
      <p>
        AI 鑑定機能でアップロードされたカード画像は、鑑定結果の生成および履歴表示のため
        最大 30 日間 サーバーに保管されます。第三者への提供は行いません。
        鑑定履歴ページからユーザー自身でいつでも削除リクエストを行えます。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">7. 情報の第三者提供</h2>
      <p>
        本サイトは法令に基づく場合を除き、ユーザーの同意なく取得した情報を第三者に提供することはありません。
        ただし、本ポリシーの第3条〜第5条に記載した範囲内で、サービス提供のために必要な情報を第三者サービスに送信することがあります。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">8. ユーザーの権利</h2>
      <p>
        ユーザーは自身の個人情報の開示・訂正・削除を請求する権利があります。
        ご請求の際は{" "}
        <Link href="/contact" className="text-blue-700 hover:underline">
          お問い合わせフォーム
        </Link>
        よりご連絡ください。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">9. プライバシーポリシーの変更</h2>
      <p>
        本ポリシーは予告なく変更される場合があります。重要な変更がある場合は、本ページにて告知します。
        変更後の本ポリシーは、本サイトに掲載された時点から効力を生じるものとします。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">10. お問い合わせ</h2>
      <p>
        本ポリシーに関するお問い合わせは{" "}
        <Link href="/contact" className="text-blue-700 hover:underline">
          お問い合わせページ
        </Link>{" "}
        よりお願いいたします。
      </p>

      <p className="text-xs text-gray-500 mt-8">© TCG Authority</p>
    </article>
  );
}
