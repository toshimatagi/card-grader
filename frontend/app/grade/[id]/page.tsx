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
