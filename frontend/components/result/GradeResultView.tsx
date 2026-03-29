"use client";

import { useState } from "react";
import { GradeResult } from "../../lib/api";
import ScoreGauge from "./ScoreGauge";
import EbaySoldPrices from "./EbaySoldPrices";

interface Props {
  result: GradeResult;
  cardName?: string;
  brand?: string;
}

const SUB_GRADE_LABELS: Record<string, { label: string; icon: string }> = {
  centering: { label: "センタリング", icon: "🎯" },
  surface: { label: "表面状態", icon: "🔍" },
  color_print: { label: "色・印刷", icon: "🎨" },
  edges_corners: { label: "エッジ・角", icon: "📐" },
};

const OVERLAY_LABELS: Record<string, string> = {
  centering: "センタリング",
  surface_defects: "表面傷",
  color_analysis: "色分析",
  edges_corners: "エッジ・角",
};

export default function GradeResultView({ result, cardName, brand }: Props) {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const gradeColor = (score: number): string => {
    if (score >= 9) return "text-green-600";
    if (score >= 7) return "text-blue-600";
    if (score >= 5) return "text-yellow-600";
    return "text-red-600";
  };

  const gradeBg = (score: number): string => {
    if (score >= 9) return "bg-green-100 border-green-300";
    if (score >= 7) return "bg-blue-100 border-blue-300";
    if (score >= 5) return "bg-yellow-100 border-yellow-300";
    return "bg-red-100 border-red-300";
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー: 総合スコア */}
      <div className={`rounded-xl border-2 p-6 ${gradeBg(result.overall_grade)}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">
              総合グレード
            </div>
            <div className={`text-5xl font-bold ${gradeColor(result.overall_grade)}`}>
              {result.overall_grade.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              / 10.0 (PSA基準)
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">信頼度</div>
            <div className="text-2xl font-semibold">
              {(result.confidence * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              カードタイプ: {result.card_type === "standard" ? "スタンダード" : "スモール"}
            </div>
          </div>
        </div>
      </div>

      {/* サブグレード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(result.sub_grades).map(([key, grade]) => {
          const meta = SUB_GRADE_LABELS[key];
          if (!meta) return null;
          return (
            <div
              key={key}
              className="bg-white rounded-lg border p-4 text-center shadow-sm"
            >
              <div className="text-2xl mb-1">{meta.icon}</div>
              <div className="text-xs text-gray-500 mb-2">{meta.label}</div>
              <ScoreGauge score={grade.score} />
            </div>
          );
        })}
      </div>

      {/* カード画像 & オーバーレイ */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">分析画像</h2>

        {/* オーバーレイ切替タブ */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setActiveOverlay(null)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              activeOverlay === null
                ? "bg-gray-900 text-white"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            元画像
          </button>
          {Object.entries(result.overlay_images).map(([key, _]) => (
            <button
              key={key}
              onClick={() => setActiveOverlay(key)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                activeOverlay === key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              {OVERLAY_LABELS[key] || key}
            </button>
          ))}
        </div>

        {/* 画像表示 */}
        <div className="flex justify-center">
          <img
            src={`data:image/jpeg;base64,${
              activeOverlay && result.overlay_images[activeOverlay]
                ? result.overlay_images[activeOverlay]
                : result.card_image
            }`}
            alt={activeOverlay ? `${activeOverlay} overlay` : "カード画像"}
            className="max-h-[500px] rounded-lg shadow-md"
          />
        </div>
      </div>

      {/* 詳細データ */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">詳細分析データ</h2>

        <div className="space-y-6">
          {/* センタリング詳細 */}
          <DetailSection
            title="センタリング"
            icon="🎯"
            score={result.sub_grades.centering.score}
          >
            <div className="grid grid-cols-2 gap-4">
              <DataItem
                label="左右比率"
                value={String(result.sub_grades.centering.detail.lr_ratio)}
              />
              <DataItem
                label="上下比率"
                value={String(result.sub_grades.centering.detail.tb_ratio)}
              />
              <DataItem
                label="左ボーダー"
                value={`${result.sub_grades.centering.detail.left_border}px`}
              />
              <DataItem
                label="右ボーダー"
                value={`${result.sub_grades.centering.detail.right_border}px`}
              />
              <DataItem
                label="上ボーダー"
                value={`${result.sub_grades.centering.detail.top_border}px`}
              />
              <DataItem
                label="下ボーダー"
                value={`${result.sub_grades.centering.detail.bottom_border}px`}
              />
            </div>
          </DetailSection>

          {/* 表面状態詳細 */}
          <DetailSection
            title="表面状態"
            icon="🔍"
            score={result.sub_grades.surface.score}
          >
            <div className="grid grid-cols-2 gap-4">
              <DataItem
                label="傷の数"
                value={`${result.sub_grades.surface.detail.scratches}件`}
              />
              <DataItem
                label="深刻度"
                value={String(result.sub_grades.surface.detail.severity)}
              />
              <DataItem
                label="ホワイトニング"
                value={String(result.sub_grades.surface.detail.whitening)}
              />
            </div>
            {Array.isArray(result.sub_grades.surface.detail.defects) &&
              result.sub_grades.surface.detail.defects.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">
                    検出された欠陥
                  </div>
                  <div className="space-y-1">
                    {(result.sub_grades.surface.detail.defects as Array<Record<string, unknown>>).map(
                      (d, i) => (
                        <div
                          key={i}
                          className="text-xs bg-gray-50 rounded px-2 py-1 flex justify-between"
                        >
                          <span>{String(d.type)}</span>
                          <span className="text-gray-500">
                            {String(d.severity)} - {String(d.location)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
          </DetailSection>

          {/* 色・印刷詳細 */}
          <DetailSection
            title="色・印刷"
            icon="🎨"
            score={result.sub_grades.color_print.score}
          >
            <div className="grid grid-cols-2 gap-4">
              <DataItem
                label="色褪せ度"
                value={`${((result.sub_grades.color_print.detail.fading as number) * 100).toFixed(1)}%`}
              />
              <DataItem
                label="インク均一性"
                value={`${((result.sub_grades.color_print.detail.ink_uniformity as number) * 100).toFixed(1)}%`}
              />
              <DataItem
                label="彩度スコア"
                value={`${((result.sub_grades.color_print.detail.saturation_score as number) * 100).toFixed(1)}%`}
              />
              <DataItem
                label="ホロ/フォイル"
                value={result.sub_grades.color_print.detail.is_holo ? "Yes" : "No"}
              />
            </div>
          </DetailSection>

          {/* エッジ・角詳細 */}
          <DetailSection
            title="エッジ・角"
            icon="📐"
            score={result.sub_grades.edges_corners.score}
          >
            <div className="grid grid-cols-2 gap-4">
              <DataItem
                label="エッジ直線性"
                value={`${((result.sub_grades.edges_corners.detail.edge_straightness as number) * 100).toFixed(1)}%`}
              />
              <DataItem
                label="角の均一性"
                value={`${((result.sub_grades.edges_corners.detail.corner_roundness_uniformity as number) * 100).toFixed(1)}%`}
              />
            </div>
          </DetailSection>
        </div>
      </div>

      {/* eBay Sold価格 */}
      {cardName && <EbaySoldPrices cardName={cardName} brand={brand || ""} />}
    </div>
  );
}

function DetailSection({
  title,
  icon,
  score,
  children,
}: {
  title: string;
  icon: string;
  score: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium flex items-center gap-2">
          <span>{icon}</span>
          {title}
        </h3>
        <span className="text-lg font-bold">{score.toFixed(1)}</span>
      </div>
      {children}
    </div>
  );
}

function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
