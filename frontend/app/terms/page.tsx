import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約",
  description:
    "TCG Authority の利用規約。価格データの取り扱い・AI鑑定の位置づけ・免責事項・知的財産権について。",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

const UPDATED_AT = "2026-05-10";

export default function TermsPage() {
  return (
    <article className="max-w-3xl mx-auto prose prose-sm">
      <nav className="text-xs text-gray-500 mb-2 not-prose">
        <Link href="/" className="hover:underline">トップ</Link>
        <span className="mx-1.5">/</span>
        <span>利用規約</span>
      </nav>

      <h1 className="text-2xl font-bold mb-2">利用規約</h1>
      <p className="text-xs text-gray-500 mb-6">最終更新: {UPDATED_AT}</p>

      <p>
        本規約は、TCG Authority (https://tcg-authority.com、以下「本サイト」)
        の利用条件を定めるものです。ユーザーは本サイトを利用することで本規約に同意したものとみなされます。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">第1条 (定義)</h2>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li><strong>本サービス</strong>: 本サイトが提供する価格データベース、AI 鑑定、値上がりランキング等のすべての機能</li>
        <li><strong>ユーザー</strong>: 本サービスにアクセス・利用するすべての者</li>
        <li><strong>運営者</strong>: 本サイトを運営する者</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">第2条 (本サービスの内容)</h2>
      <p>
        本サービスは、ワンピースカードゲームおよびポケモンカードゲーム等のトレーディングカードに関する
        参考情報 (相場、グレード別推定価格、AI による状態鑑定等) を無料で提供するものです。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">第3条 (価格データに関する注意)</h2>
      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>
          本サイトに掲載されている価格は、複数の取扱いサイト・オークション・フリマ等の公開データから集計した
          <strong>参考中央値</strong>であり、特定の店舗や事業者における取引価格を保証するものではありません。
        </li>
        <li>
          相場は時々刻々変動します。表示時点の数値が現在の取引可能価格と一致することは保証されません。
        </li>
        <li>
          本サイトの価格情報を元に行った売買・投資判断によりユーザーが被ったいかなる損害についても、運営者は責任を負いません。
        </li>
      </ol>

      <h2 className="text-lg font-bold mt-6 mb-2">第4条 (AI 鑑定の位置づけ)</h2>
      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>
          本サイトの AI 鑑定機能は、アップロードされたカード画像から
          <strong>センタリング・コーナー・エッジ・サーフェス</strong>等を画像認識で推定する
          補助ツールであり、PSA / BGS 等の正式な鑑定機関による鑑定結果とは異なります。
        </li>
        <li>
          AI 鑑定のスコアは <strong>参考目安</strong>として提供されるものであり、特定のグレード取得を保証するものではありません。
        </li>
        <li>
          AI 鑑定の結果に基づく PSA / BGS 等への提出判断、ならびにその結果による経済的損益について、
          運営者は一切の責任を負いません。
        </li>
      </ol>

      <h2 className="text-lg font-bold mt-6 mb-2">第5条 (禁止事項)</h2>
      <p>ユーザーは本サービスの利用にあたり、以下の行為を行ってはなりません。</p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>本サービスの運営を妨害する行為</li>
        <li>サーバーに過度な負荷をかける自動アクセス・スクレイピング</li>
        <li>本サービスのコンテンツを無断で複製・再配布する行為 (引用範囲を除く)</li>
        <li>第三者の権利を侵害する画像・情報のアップロード</li>
        <li>違法な目的または公序良俗に反する目的での利用</li>
        <li>本規約・関連法令に違反する行為</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">第6条 (知的財産権)</h2>
      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>
          本サイトに掲載されているテキスト・分析・ガイド・UI 等のコンテンツの著作権は運営者に帰属します。
        </li>
        <li>
          本サイトに表示されるカード画像、カード名、商品画像、ブランドロゴ等の権利は、それぞれの権利者に帰属します。
          本サイトはあくまで価格情報の参考表示および鑑定補助のため、これらを利用しています。
        </li>
        <li>
          ポケットモンスター・ポケモン・Pokémon は任天堂・クリーチャーズ・ゲームフリークの商標です。
          ONE PIECE および関連するキャラクター・ロゴはバンダイ／集英社の商標です。
          本サイトは公式サイトではありません。
        </li>
      </ol>

      <h2 className="text-lg font-bold mt-6 mb-2">第7条 (免責事項)</h2>
      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>
          運営者は本サイトの情報の正確性・完全性・最新性を保証しません。
        </li>
        <li>
          本サイトのリンク先サービス・第三者サイトの内容について、運営者は一切の責任を負いません。
        </li>
        <li>
          本サイトの利用または利用不能から生じるユーザーの損害について、運営者は一切の責任を負いません。
        </li>
      </ol>

      <h2 className="text-lg font-bold mt-6 mb-2">第8条 (サービスの変更・終了)</h2>
      <p>
        運営者は予告なく本サービスの内容を変更、または提供を終了することがあります。
        これによりユーザーに損害が発生したとしても、運営者は責任を負いません。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">第9条 (規約の変更)</h2>
      <p>
        運営者は必要に応じて本規約を変更することがあります。
        変更後の規約は本サイトに掲載した時点から効力を生じます。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">第10条 (準拠法・管轄)</h2>
      <p>
        本規約は日本法に準拠し、本サービスに関して紛争が生じた場合は運営者の所在地を管轄する裁判所を専属的合意管轄とします。
      </p>

      <p className="text-xs text-gray-500 mt-8">© TCG Authority</p>
    </article>
  );
}
