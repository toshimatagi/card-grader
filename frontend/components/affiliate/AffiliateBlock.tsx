import Link from "next/link";

/**
 * 鑑定結果ページ等に掲載するアフィリエイトブロック。
 *
 * 現状は API 経由でアフィリエイトコードを受け取らず、env / 定数で管理する。
 * URLs は AFFILIATE_LINKS で集中管理し、ASP 加入後にここを編集するだけで
 * 全ページに反映される。
 *
 * UX 方針:
 * - 高グレード (PSA10/9 候補, overall >= 8.5) は買取査定 CTA を主役に
 * - 低〜中グレードは「保管用サプライ」を訴求 (PSA再提出のため状態維持が必要)
 * - 「広告」ラベルを必ず付け、表示の透明性を確保
 */

type Props = {
  /** 鑑定結果ページなど、スコアが既にある場合 (高グレード時に買取CTA表示) */
  overallGrade?: number;
  /** 表示コンテキスト: 'result' 鑑定結果ページ / 'top' TOPページ */
  context?: "result" | "top";
};

// Amazon アソシエイト ID (タグ)
// 環境変数で上書き可能。未設定時は placeholder の "tcgauthority-22" を使用。
const AMAZON_TAG =
  process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG || "tcgauthority-22";

/** Amazon 検索リンク with アソシエイトタグ */
function amazonSearchUrl(keyword: string): string {
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}&tag=${AMAZON_TAG}`;
}

// 設定: ASP 加入後にここを編集
const AFFILIATE_LINKS = {
  // 買取サイト (A8等で取得後置換)
  kaitori: [
    // {
    //   name: "トレトク",
    //   url: "https://px.a8.net/r3/[YOUR_ASP_CODE]",
    //   desc: "宅配買取・送料無料",
    //   ctaText: "無料査定する",
    // },
  ] as Array<{
    name: string;
    url: string;
    desc: string;
    ctaText: string;
  }>,
  // Amazon サプライ商品 (3点)
  // インナースリーブ / スリーブ / ローダー の定番3点
  supply: [
    {
      name: "インナースリーブ (ジャストフィット)",
      url: amazonSearchUrl("TCG インナースリーブ ジャストフィット"),
      desc: "カード本体に直接被せる薄手スリーブ。指紋・摩擦を防ぐ一次保護",
    },
    {
      name: "オーバースリーブ (キャラクタースリーブ対応)",
      url: amazonSearchUrl("カードスリーブ オーバー キャラクタースリーブ対応"),
      desc: "インナーの上から重ねる二重スリーブの外側。デッキ運用・メルカリ発送に",
    },
    {
      name: "トップローダー (35pt 〜 130pt)",
      url: amazonSearchUrl("トップローダー TCG"),
      desc: "硬質プラスチック。高額カードの折り曲げ・水濡れを完全に防ぐ",
    },
  ],
};

export default function AffiliateBlock({
  overallGrade = 0,
  context = "result",
}: Props) {
  const isHighGrade = overallGrade >= 8.5;
  const hasKaitori = AFFILIATE_LINKS.kaitori.length > 0;
  // 3点固定 (インナースリーブ / スリーブ / ローダー)
  const supplyToShow = AFFILIATE_LINKS.supply;
  const isTop = context === "top";

  return (
    <div className="mt-6 space-y-4">
      {/* 買取セクション (高グレード時に強調) */}
      {isHighGrade && (
        <section
          className={`rounded-lg border-2 p-4 ${
            hasKaitori
              ? "border-emerald-400 bg-emerald-50"
              : "border-gray-300 bg-gray-50"
          }`}
        >
          <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
            <h3 className="text-base font-bold text-emerald-900">
              💴 高グレード相当なら買取査定を検討
            </h3>
            <span className="text-[10px] text-gray-500 bg-white border px-1.5 py-0.5 rounded">
              広告
            </span>
          </div>
          <p className="text-xs text-gray-700 mb-3 leading-relaxed">
            AI 鑑定の総合スコア{" "}
            <strong>{overallGrade.toFixed(1)}</strong> は PSA10 / PSA9 候補相当。
            鑑定提出に時間をかけたくない場合や、Raw のまま売却したい場合は
            買取サービスでの査定が早道です。
          </p>
          {hasKaitori ? (
            <ul className="space-y-2">
              {AFFILIATE_LINKS.kaitori.map((k) => (
                <li
                  key={k.name}
                  className="flex items-center gap-3 p-2 bg-white rounded border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{k.name}</div>
                    <div className="text-xs text-gray-600">{k.desc}</div>
                  </div>
                  <a
                    href={k.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow sponsored"
                    className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 whitespace-nowrap"
                  >
                    {k.ctaText} →
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-gray-500 bg-white border rounded p-2">
              買取サービス提携を準備中です。
            </div>
          )}
        </section>
      )}

      {/* サプライ商品セクション (全カードで表示) — Amazon アソシエイト */}
      <section className="rounded-lg border bg-white p-4">
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-base font-bold text-gray-800">
            🃏 {isTop ? "鑑定前に揃えておきたい必須サプライ" : "カード保護に必須の定番サプライ"}
          </h3>
          <span className="text-[10px] text-gray-500 bg-gray-100 border px-1.5 py-0.5 rounded">
            広告
          </span>
        </div>
        <p className="text-xs text-gray-600 mb-3 leading-relaxed">
          {isTop
            ? "鑑定するカードは事前に保護しておくとセンタリング・コーナーの状態が安定します。"
            : "状態を保ったままフリマ発送・PSA / BGS 提出するには"}
          <strong>インナースリーブ + オーバースリーブ + トップローダー</strong>
          の三重保護が定番。
          {isHighGrade && " 高額カードは特にしっかり保管推奨。"}
        </p>
        <ul className="space-y-2">
          {supplyToShow.map((s) => (
            <li
              key={s.name}
              className="flex items-center gap-3 p-2 bg-gray-50 rounded border"
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{s.name}</div>
                <div className="text-xs text-gray-600">{s.desc}</div>
              </div>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 whitespace-nowrap"
              >
                Amazon で見る →
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] text-gray-500">
          ※ 当サイトはアフィリエイトプログラムに参加しています。リンク経由でご購入された場合、
          手数料が当サイトに支払われることがあります。商品価格はユーザーに影響しません。
        </p>
      </section>

      {/* 関連ガイド誘導 */}
      <section className="rounded border border-blue-200 bg-blue-50 p-3 text-sm">
        <div className="font-bold text-blue-900 mb-1">
          📖 詳しく知りたい方は
        </div>
        <ul className="space-y-0.5 text-xs">
          <li>
            →{" "}
            <Link
              href="/guide/psa10-tousenritu"
              className="text-blue-700 hover:underline"
            >
              PSA10 取得率と提出前チェック5項目
            </Link>
          </li>
          <li>
            →{" "}
            <Link
              href="/guide/kantei-teisyutsu"
              className="text-blue-700 hover:underline"
            >
              鑑定提出 完全マニュアル (PSA / BGS の選び方)
            </Link>
          </li>
          <li>
            →{" "}
            <Link
              href="/guide/mercari-takaku-uru"
              className="text-blue-700 hover:underline"
            >
              メルカリで高く売るコツ
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
