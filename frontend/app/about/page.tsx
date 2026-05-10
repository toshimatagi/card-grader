import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "サイトについて — 運営方針と提供価値",
  description:
    "TCG Authority の運営方針・提供価値・データソースについて。ワンピカード・ポケカの相場と AI 鑑定を集約する独立メディア。",
  alternates: { canonical: "/about" },
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return (
    <article className="max-w-3xl mx-auto prose prose-sm">
      <nav className="text-xs text-gray-500 mb-2 not-prose">
        <Link href="/" className="hover:underline">トップ</Link>
        <span className="mx-1.5">/</span>
        <span>サイトについて</span>
      </nav>

      <h1 className="text-2xl font-bold mb-2">サイトについて</h1>

      <h2 className="text-lg font-bold mt-6 mb-2">TCG Authority とは</h2>
      <p>
        TCG Authority (https://tcg-authority.com) は、
        ワンピースカードゲームおよびポケモンカードゲームを中心とした
        トレーディングカードの <strong>相場情報・状態鑑定・トレンド分析</strong>{" "}
        を一元的に提供する独立メディアです。
      </p>
      <p>
        フリマアプリでカードを購入する前の相場確認、PSA / BGS 鑑定提出前の
        セルフチェック、コレクションの時価評価、仕入れ・転売の利幅判断など、
        カードプレイヤー・コレクター・トレーダーのいずれの目的にも対応します。
        <strong>登録不要・完全無料</strong>でご利用いただけます。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">提供している主な価値</h2>
      <ul className="list-disc list-inside space-y-2 text-sm">
        <li>
          <strong>価格データベース</strong> — 6,800+ カード (ワンピース・ポケモン)
          の販売中央値・買取価格を継続的に集計
        </li>
        <li>
          <strong>状態別 推定相場</strong> — Raw (未鑑定) / PSA10 / PSA9 / BGS 別の
          価格データを並べて表示。鑑定提出時の利幅予測に活用可能
        </li>
        <li>
          <strong>値上がりランキング</strong> — 24時間 / 7日 / 30日 単位での
          上昇率トップ。ホットカードの早期キャッチに
        </li>
        <li>
          <strong>Raw → PSA10 倍率TOP</strong> — 鑑定提出で価格が大きく跳ねるカードの一覧。
          一般的な情報サイトにはない独自指標
        </li>
        <li>
          <strong>AI 鑑定 (表裏チェック)</strong> — 表面・裏面の写真から
          センタリング・コーナー・エッジ・サーフェスのスコアを自動算出。
          PSA / BGS 提出前のセルフチェックに
        </li>
        <li>
          <strong>各種ガイド記事</strong> — PSA10 取得率、鑑定提出マニュアル、
          メルカリで高く売るコツ等の実践的ノウハウ
        </li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">データソース</h2>
      <p>
        本サイトの価格データは、国内の TCG 通販サイト・オークション・フリマ等の
        公開済み売買情報から日次〜時間単位で集計しています。
        集計の中央値・サンプル数・最終更新日時を各カードページに表示し、
        信頼度をユーザーが判断できるようにしています。
      </p>
      <p>
        AI 鑑定は OpenCV ベースの画像処理アルゴリズムを使用しており、
        PSA / BGS 等の正式な鑑定機関の判定とは異なります。
        スコアはあくまで参考目安であり、最終判断は実物確認と公式鑑定機関にお任せください。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">運営ポリシー</h2>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>独立した第三者メディアとして、特定のカードショップ・買取業者の宣伝目的では運営しません</li>
        <li>すべてのコンテンツは無料で提供します</li>
        <li>ユーザーから入力された個人情報は{" "}
          <Link href="/privacy" className="text-blue-700 hover:underline">プライバシーポリシー</Link>{" "}
          に従って取り扱います</li>
        <li>カード画像・カード名等の知的財産権はそれぞれの権利者に帰属します。本サイトは価格情報の参考表示および鑑定補助のため使用しています</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">対応TCG</h2>
      <table className="w-full text-sm border-collapse mb-3">
        <thead><tr className="bg-gray-100 text-left"><th className="border p-2">機能</th><th className="border p-2">対応TCG</th></tr></thead>
        <tbody>
          <tr><td className="border p-2 font-medium">価格DB / 値上がりランキング</td><td className="border p-2">ワンピース・ポケモン</td></tr>
          <tr><td className="border p-2 font-medium">状態別 (Raw/PSA10/PSA9) 相場</td><td className="border p-2">ワンピース・ポケモン</td></tr>
          <tr><td className="border p-2 font-medium">AI 鑑定 (表裏チェック)</td><td className="border p-2">ワンピース・ポケモン・遊戯王・ドラゴンボールFusionWorld</td></tr>
        </tbody>
      </table>

      <h2 className="text-lg font-bold mt-6 mb-2">関連リンク</h2>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li><Link href="/guide" className="text-blue-700 hover:underline">使い方ガイド</Link></li>
        <li><Link href="/privacy" className="text-blue-700 hover:underline">プライバシーポリシー</Link></li>
        <li><Link href="/terms" className="text-blue-700 hover:underline">利用規約</Link></li>
        <li><Link href="/contact" className="text-blue-700 hover:underline">お問い合わせ</Link></li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">免責</h2>
      <p>
        本サイトの情報は参考情報として提供されており、その正確性・完全性・最新性を保証するものではありません。
        本サイトの情報を元に行った取引・投資判断・鑑定提出によりユーザーが被ったいかなる損害についても、運営者は責任を負いません。
      </p>
      <p className="text-xs text-gray-500">
        ポケットモンスター・ポケモン・Pokémon は任天堂・クリーチャーズ・ゲームフリークの商標です。
        ONE PIECE および関連商標はバンダイ／集英社の商標です。
        本サイトは公式サイトではありません。
      </p>

      <p className="text-xs text-gray-500 mt-8">© TCG Authority</p>
    </article>
  );
}
