import Link from "next/link";
import type { Metadata } from "next";
import { recentWeekSlugs, parseWeekSlug, formatWeekRange, currentWeekSlug } from "../../lib/weeks";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export const metadata: Metadata = {
  title: "週次 値上がりレポート — ワンピ・ポケカの直近トレンド",
  description:
    "ワンピースカード・ポケモンカードの週次値上がり / PSA10 倍率レポート。週ごとに更新される直近トレンド情報をアーカイブ形式で配信。",
  alternates: { canonical: "/weekly" },
  keywords: [
    "ワンピカード 週間 値上がり", "ポケカ 週間 値上がり",
    "週次レポート", "TCG トレンド", "PSA10 トレンド",
    "今週の値上がり", "ワンピ 週ベスト", "ポケカ 週ベスト",
  ],
  openGraph: {
    title: "週次 値上がりレポート | TCG Authority",
    description: "ワンピ・ポケカの週次トレンド・PSA10倍率レポート",
    url: "/weekly",
  },
};

export default function WeeklyIndex() {
  const slugs = recentWeekSlugs(12); // 直近 12 週
  const current = currentWeekSlug();

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/" className="hover:underline">トップ</Link>
        <span className="mx-1.5">/</span>
        <span>週次レポート</span>
      </nav>

      <h1 className="text-2xl font-bold mb-3">📊 週次 値上がりレポート</h1>
      <p className="text-sm text-gray-700 mb-6 leading-relaxed">
        ワンピース・ポケモンカードの 直近1週間で値上がりしたカード TOP / PSA10
        相場の動き / Raw→PSA10 倍率の高いカードを週ごとにまとめてアーカイブ。
        毎週木曜日に集計を更新します。
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {slugs.map((slug, i) => {
          const parsed = parseWeekSlug(slug);
          if (!parsed) return null;
          const isCurrent = slug === current;
          return (
            <Link
              key={slug}
              href={`/weekly/${slug}`}
              className={`block p-3 rounded-lg border transition-shadow hover:shadow-md ${
                isCurrent
                  ? "border-yellow-500 bg-yellow-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="text-[10px] text-gray-500 mb-1 font-mono">
                {slug}
                {isCurrent && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-yellow-400 text-yellow-900 text-[9px] font-bold">
                    今週
                  </span>
                )}
              </div>
              <div className="text-sm font-bold leading-tight">
                {formatWeekRange(parsed.year, parsed.week)}
              </div>
              {i === 0 && (
                <div className="text-[10px] text-gray-500 mt-1">最新トレンド</div>
              )}
            </Link>
          );
        })}
      </div>

      <section className="mt-8 border-t pt-5 text-sm text-gray-600">
        <h2 className="font-bold text-gray-800 mb-2">週次レポートで分かること</h2>
        <ul className="list-disc list-inside space-y-1 leading-relaxed">
          <li>その週で <strong>販売中央値が上昇</strong> したカード TOP10 (両ブランド)</li>
          <li>その週時点での <strong>Raw → PSA10 倍率</strong> 上位カード</li>
          <li>注目セット (例: 新弾発売直後の動き)</li>
          <li>長期保有 vs 短期転売 の判断材料</li>
        </ul>
      </section>
    </div>
  );
}
