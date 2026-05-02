"use client";

import { useState } from "react";
import { GradeResult } from "../../lib/api";
import ScoreGauge from "./ScoreGauge";
import CardPriceSummary from "../cards/CardPriceSummary";
import BackSideCentering from "../centering/BackSideCentering";

interface Props {
  result: GradeResult;
  cardName?: string;
  brand?: string;
  shareUrl?: string;
  cardId?: string;
  cardCode?: string;
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

export default function GradeResultView({ result, cardName, brand, shareUrl: shareUrlProp, cardCode }: Props) {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [showThirds, setShowThirds] = useState(false);

  const shareUrl =
    shareUrlProp ||
    (typeof window !== "undefined" ? `${window.location.origin}/grade/${result.id}` : "");
  const cardLabel = cardName?.trim();
  const shareTitle = cardLabel
    ? `${cardLabel} 鑑定結果: 総合 ${result.overall_grade.toFixed(1)} / 10.0 — TCG Authority`
    : `鑑定結果: 総合 ${result.overall_grade.toFixed(1)} / 10.0 — TCG Authority`;
  const shareText = `センタリング ${result.sub_grades.centering.score} / 表面 ${result.sub_grades.surface.score} / 色印刷 ${result.sub_grades.color_print.score} / エッジ ${result.sub_grades.edges_corners.score}`;
  const brandHashtag: Record<string, string> = {
    onepiece: "ワンピカード",
    pokemon: "ポケカ",
    yugioh: "遊戯王",
    dragonball_fw: "ドラゴンボールFW",
  };
  const hashtags = ["カード鑑定", brand ? brandHashtag[brand] : ""].filter(Boolean).join(",");

  const handleShare = async () => {
    if (!shareUrl) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch {
        // ユーザーがキャンセルした場合は無視してクリップボードへフォールバック
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tweetUrl = shareUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle + "\n" + shareText)}&url=${encodeURIComponent(shareUrl)}${hashtags ? `&hashtags=${encodeURIComponent(hashtags)}` : ""}`
    : "";

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
      {/* シェアボタン */}
      {shareUrl && (
        <div className="flex justify-end gap-2">
          <button
            onClick={handleShare}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium flex items-center gap-1.5"
            title="結果を共有"
          >
            🔗 {copied ? "URLをコピーしました" : "結果を共有"}
          </button>
          {tweetUrl && (
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 text-sm font-medium flex items-center gap-1.5"
              title="Xでシェア"
            >
              𝕏 シェア
            </a>
          )}
        </div>
      )}

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
        <div className="flex gap-2 mb-3 flex-wrap">
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

        {/* ガイドラインのトグル */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <span className="text-xs text-gray-500">ガイド:</span>
          <button
            onClick={() => setShowCrosshair((v) => !v)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              showCrosshair
                ? "bg-red-500 text-white border-red-500"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
            title="画像の中央 (50:50) に十字線を表示"
          >
            ✚ 十字線 (50:50)
          </button>
          <button
            onClick={() => setShowThirds((v) => !v)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              showThirds
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
            title="三分割線 (1/3, 2/3) を表示"
          >
            ▦ 三分割線
          </button>
        </div>

        {/* 画像表示 (十字線オーバーレイ可能) */}
        <div className="flex justify-center">
          <div className="relative inline-block">
            <img
              src={`data:image/jpeg;base64,${
                activeOverlay && result.overlay_images[activeOverlay]
                  ? result.overlay_images[activeOverlay]
                  : result.card_image
              }`}
              alt={activeOverlay ? `${activeOverlay} overlay` : "カード画像"}
              className="max-h-[500px] rounded-lg shadow-md block"
            />
            {(showCrosshair || showThirds) && (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
              >
                {showThirds && (
                  <g stroke="rgb(96, 165, 250)" strokeWidth="0.25" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" opacity="0.85">
                    <line x1="33.333" y1="0" x2="33.333" y2="100" />
                    <line x1="66.667" y1="0" x2="66.667" y2="100" />
                    <line x1="0" y1="33.333" x2="100" y2="33.333" />
                    <line x1="0" y1="66.667" x2="100" y2="66.667" />
                  </g>
                )}
                {showCrosshair && (
                  <g vectorEffect="non-scaling-stroke">
                    {/* 半透明の白アウトライン (どんな背景色でも視認できるように) */}
                    <line x1="50" y1="0" x2="50" y2="100" stroke="white" strokeWidth="0.9" opacity="0.6" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="white" strokeWidth="0.9" opacity="0.6" />
                    {/* 赤の本線 */}
                    <line x1="50" y1="0" x2="50" y2="100" stroke="rgb(239, 68, 68)" strokeWidth="0.4" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="rgb(239, 68, 68)" strokeWidth="0.4" />
                    {/* 中心マーカー */}
                    <circle cx="50" cy="50" r="0.9" fill="white" stroke="rgb(239, 68, 68)" strokeWidth="0.3" />
                    {/* 軸ラベル */}
                    <text x="51" y="3" fontSize="2.2" fill="rgb(239, 68, 68)" stroke="white" strokeWidth="0.4" paintOrder="stroke" fontWeight="bold">50%</text>
                    <text x="0.5" y="51.7" fontSize="2.2" fill="rgb(239, 68, 68)" stroke="white" strokeWidth="0.4" paintOrder="stroke" fontWeight="bold">50%</text>
                  </g>
                )}
              </svg>
            )}
          </div>
        </div>
        {showCrosshair && (
          <p className="text-xs text-gray-500 text-center mt-2">
            ✚ 画像の中央 (50:50) に十字線を表示中。印刷中央がこの線とどれだけズレているかでセンタリングを目視確認できます。
          </p>
        )}
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

      {/* 裏面センタリング (任意) */}
      <BackSideCentering
        frontCentering={{
          lr_ratio: result.sub_grades.centering.detail.lr_ratio as string | undefined,
          tb_ratio: result.sub_grades.centering.detail.tb_ratio as string | undefined,
        }}
      />

      {/* 価格DB（販売・買取の中央値） */}
      {cardCode && <CardPriceSummary code={cardCode} />}
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
