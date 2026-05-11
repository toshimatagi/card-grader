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
  overallGrade: number;
};

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
  // Amazon サプライ (Amazon アソシエイト ID 取得後にタグ付け)
  supply: [
    {
      name: "Card Saver IV (硬質ホルダー)",
      url: "https://www.amazon.co.jp/s?k=Card+Saver+IV",
      desc: "PSA / BGS 提出時の標準ホルダー。鑑定機関への発送で必須",
    },
    {
      name: "マグネットカードホルダー (35pt)",
      url: "https://www.amazon.co.jp/s?k=マグネットカードホルダー+35pt",
      desc: "Raw 高額カードの保管。ホコリ・水濡れから完全保護",
    },
    {
      name: "ペニースリーブ + ハードスリーブ",
      url: "https://www.amazon.co.jp/s?k=ペニースリーブ+ハードスリーブ",
      desc: "メルカリ発送・PSA提出前の二重保護",
    },
    {
      name: "Ultra Pro オーバースリーブ",
      url: "https://www.amazon.co.jp/s?k=Ultra+Pro+オーバースリーブ",
      desc: "プレイ用にも観賞用にも使える定番スリーブ",
    },
  ],
};

export default function AffiliateBlock({ overallGrade }: Props) {
  const isHighGrade = overallGrade >= 8.5;
  const hasKaitori = AFFILIATE_LINKS.kaitori.length > 0;
  const supplyToShow = isHighGrade
    ? AFFILIATE_LINKS.supply.slice(0, 2) // 高グレードは買取主役、サプライ少なめ
    : AFFILIATE_LINKS.supply.slice(0, 4); // それ以外はサプライ主役

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

      {/* サプライ商品セクション (全カードで表示) */}
      <section className="rounded-lg border bg-white p-4">
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-base font-bold text-gray-800">
            🃏 鑑定後の保管・売却で必要なもの
          </h3>
          <span className="text-[10px] text-gray-500 bg-gray-100 border px-1.5 py-0.5 rounded">
            広告
          </span>
        </div>
        <p className="text-xs text-gray-600 mb-3 leading-relaxed">
          PSA / BGS 鑑定提出やフリマ売却の際、状態維持のために必要な定番アイテム。
          {isHighGrade && " 高額カードは特に厳重な保管を推奨。"}
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
