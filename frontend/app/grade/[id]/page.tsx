import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGrade } from "../../../lib/api";
import GradeResultView from "../../../components/result/GradeResultView";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let g;
  try {
    g = await getGrade(id);
  } catch {
    return { title: "鑑定結果が見つかりません" };
  }

  const grade = g.overall_grade.toFixed(1);
  const conf = Math.round(g.confidence * 100);
  const title = `鑑定結果: 総合 ${grade} / 10.0 (信頼度 ${conf}%)`;
  const description =
    `センタリング ${g.sub_grades.centering.score} / 表面 ${g.sub_grades.surface.score} / ` +
    `色印刷 ${g.sub_grades.color_print.score} / エッジ ${g.sub_grades.edges_corners.score}。` +
    "TCG Authority の自動鑑定結果。";

  const url = `${SITE_URL}/grade/${id}`;
  // OG 画像は app/grade/[id]/opengraph-image.tsx で動的生成
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      // 個別鑑定結果は検索インデックスから除外、ただしリンク追跡は許可 (シェア時の評価のため)
      index: false,
      follow: true,
    },
  };
}

export default async function GradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let g;
  try {
    g = await getGrade(id);
  } catch {
    notFound();
  }
  if (!g) notFound();

  return (
    <div className="max-w-3xl mx-auto">
      <nav className="text-sm text-gray-500 mb-4">
        <a href="/" className="hover:underline">トップ</a>
        <span className="mx-2">/</span>
        <span>鑑定結果</span>
      </nav>
      <GradeResultView result={g} shareUrl={`${SITE_URL}/grade/${id}`} />

      {/* 推定グレード → 相場参照への動線 */}
      <EstimatedGradeAndPrice
        overallGrade={g.overall_grade}
        confidence={g.confidence}
      />

      <div className="mt-8 text-center">
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          自分のカードも鑑定してみる
        </a>
      </div>
    </div>
  );
}

/**
 * 鑑定スコアから PSA / BGS の推定グレードを示し、価格DBへの動線を提供する。
 * カード型番特定はこのページでは持っていないため、価格DB検索への遷移リンクを案内。
 */
function EstimatedGradeAndPrice({
  overallGrade,
  confidence,
}: {
  overallGrade: number;
  confidence: number;
}) {
  // overall_grade (0-10) から PSA 等価グレードを推定
  let estimatedLabel = "Raw (未鑑定相当)";
  let bgClass = "bg-gray-50 border-gray-200";
  let textClass = "text-gray-800";

  if (overallGrade >= 9.5) {
    estimatedLabel = "PSA10 相当 (Gem Mint)";
    bgClass = "bg-amber-50 border-amber-300";
    textClass = "text-amber-900";
  } else if (overallGrade >= 8.5) {
    estimatedLabel = "PSA9 相当 (Mint)";
    bgClass = "bg-blue-50 border-blue-200";
    textClass = "text-blue-900";
  } else if (overallGrade >= 7.5) {
    estimatedLabel = "PSA8 相当 (NM-MT)";
    bgClass = "bg-emerald-50 border-emerald-200";
    textClass = "text-emerald-900";
  }

  const lowConfidence = confidence < 0.7;

  return (
    <section className={`mt-8 rounded-lg border-2 ${bgClass} p-5`}>
      <h2 className={`text-lg font-bold mb-3 ${textClass}`}>
        🏆 推定 PSA グレード &amp; 相場参照
      </h2>
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <div className={`text-2xl font-extrabold ${textClass}`}>
          {estimatedLabel}
        </div>
        {lowConfidence && (
          <span className="text-xs text-gray-600">
            (信頼度 {Math.round(confidence * 100)}% — 参考値)
          </span>
        )}
      </div>
      <p className="text-sm text-gray-700 leading-relaxed mb-3">
        AI鑑定の総合スコア{" "}
        <strong>{overallGrade.toFixed(1)} / 10.0</strong>{" "}
        から、おおよその PSA 等価グレードを推定しています。実際の鑑定機関 (PSA / BGS)
        の判定とは一致しないことがあります。提出前のセルフチェック・売却価格の目安にお使いください。
      </p>
      <div className="bg-white rounded p-3 border border-gray-200 text-sm">
        <div className="font-semibold mb-2 text-gray-800">
          {estimatedLabel}の相場を確認するには:
        </div>
        <ol className="list-decimal list-inside space-y-1 text-gray-700">
          <li>
            <a href="/cards" className="text-blue-700 hover:underline">
              価格DB
            </a>
            でカード型番を検索
          </li>
          <li>
            個別カードページの「状態別 推定相場」セクションで{" "}
            <strong>{estimatedLabel}</strong>{" "}
            の中央値・サンプル数を確認
          </li>
          <li>販売中央値 と 鑑定費用・送料 を比較して提出可否を判断</li>
        </ol>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href="/cards"
          className="inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          価格DBで型番検索 →
        </a>
        <a
          href="/trending"
          className="inline-block px-4 py-2 text-sm border border-gray-300 bg-white rounded hover:bg-gray-50"
        >
          値上がりランキング
        </a>
      </div>
    </section>
  );
}
