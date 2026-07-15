"use client";

import { useState } from "react";
import { GradeResult, saveManualCentering } from "../../lib/api";
import ScoreGauge from "./ScoreGauge";
import CardPriceSummary from "../cards/CardPriceSummary";
import CenteringEditor, { CenteringResult } from "../centering/CenteringEditor";

/** API は画像を Storage URL または base64 のどちらでも返すので両対応にする */
function imageSrc(img: string): string {
  return img.startsWith("http") ? img : `data:image/jpeg;base64,${img}`;
}

interface Props {
  result: GradeResult;
  cardName?: string;
  brand?: string;
  shareUrl?: string;
  cardId?: string;
  cardCode?: string;
  hasBackImage?: boolean;
}

function bigSide(ratio: string): number {
  const [a, b] = ratio.split("/").map((n) => parseInt(n, 10));
  return Math.max(a || 0, b || 0);
}

function worstRatio(a: string, b: string): string {
  return bigSide(a) >= bigSide(b) ? a : b;
}

function ratioColor(ratio: string): string {
  const big = bigSide(ratio);
  if (big <= 55) return "text-green-600";
  if (big <= 60) return "text-yellow-600";
  return "text-red-600";
}

/**
 * センタリング測定モードのバッジ。
 * detail.mode: "gemini_ai_2call"=AI / "manual"=手動 / 未設定(None)=OpenCV自動。
 * 手動調整中（クライアント側の adjustedCentering）は手動扱いにする。
 */
function centeringModeBadge(
  mode: unknown,
  manuallyAdjusted: boolean
): { icon: string; label: string; className: string } {
  if (manuallyAdjusted || mode === "manual") {
    return { icon: "✋", label: "手動測定", className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (mode === "gemini_ai_2call") {
    return { icon: "🤖", label: "AI測定", className: "bg-indigo-50 text-indigo-700 border-indigo-200" };
  }
  return { icon: "📐", label: "自動測定", className: "bg-gray-100 text-gray-600 border-gray-200" };
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

export default function GradeResultView({ result, cardName, brand, shareUrl: shareUrlProp, cardCode, hasBackImage }: Props) {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [showThirds, setShowThirds] = useState(false);
  const [editingCentering, setEditingCentering] = useState(false);
  // 過去に保存した手動調整値があれば復元（リロード後も表示される / P1-5）
  const [adjustedCentering, setAdjustedCentering] = useState<CenteringResult | null>(
    () =>
      (result.sub_grades.centering.detail.manual_adjusted as CenteringResult | undefined) ??
      null
  );

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
      {/* 低信頼度警告 */}
      {result.confidence < 0.9 && (
        <div className="rounded-xl border border-yellow-400 bg-yellow-50 p-4 text-sm text-yellow-900">
          <div className="font-semibold mb-1">
            ⚠️ 検出精度が低い可能性があります (信頼度 {(result.confidence * 100).toFixed(0)}%)
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-xs leading-snug">
            <li>カードが画面いっぱいに写っていると輪郭を検出しにくくなります。<strong>背景が少し見える</strong>よう引いて撮影してください。</li>
            <li>斜め撮影や照明の反射がある場合は、センタリング測定ステップの「📐 傾き調整」で四隅を手動補正してください。</li>
            <li>スコアはあくまで目安です。信頼度が低い場合は再撮影後に再チェックすることを推奨します。</li>
          </ul>
        </div>
      )}

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
              総合スコア (目安)
            </div>
            <div className={`text-5xl font-bold ${gradeColor(result.overall_grade)}`}>
              {result.overall_grade.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              / 10.0
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">画像分析の信頼度</div>
            <div className="text-2xl font-semibold">
              {(result.confidence * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              カードタイプ: {result.card_type === "standard" ? "スタンダード" : "スモール"}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-black/10 text-[11px] text-gray-600 leading-snug">
          ※ 本スコアは PSA/BGS の正式鑑定ではなく、画像から計算した <strong>状態チェック目安</strong> です。PSA10 等の取得を保証するものではありません。
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
          {adjustedCentering && (
            <button
              onClick={() => setActiveOverlay("__adjusted__")}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                activeOverlay === "__adjusted__"
                  ? "bg-green-600 text-white"
                  : "bg-green-100 text-green-800 hover:bg-green-200"
              }`}
            >
              🎯 手動調整
            </button>
          )}
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
              src={imageSrc(
                activeOverlay && activeOverlay !== "__adjusted__" && result.overlay_images[activeOverlay]
                  ? result.overlay_images[activeOverlay]
                  : result.card_image
              )}
              alt={activeOverlay ? `${activeOverlay} overlay` : "カード画像"}
              className="max-h-[500px] rounded-lg shadow-md block"
            />
            {/* 手動調整センタリング枠 */}
            {activeOverlay === "__adjusted__" && adjustedCentering?.inner_corners && adjustedCentering.source_width && adjustedCentering.source_height && (() => {
              const { tl, tr, bl } = adjustedCentering.inner_corners!;
              const sw = adjustedCentering.source_width!;
              const sh = adjustedCentering.source_height!;
              const l = tl[0] / sw * 100;
              const r = tr[0] / sw * 100;
              const t = tl[1] / sh * 100;
              const b = bl[1] / sh * 100;
              return (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
                >
                  <rect
                    x={l} y={t} width={r - l} height={b - t}
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth="0.6"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              );
            })()}
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
            {(() => {
              const badge = centeringModeBadge(
                result.sub_grades.centering.detail.mode,
                !!adjustedCentering
              );
              return (
                <div className="mb-3">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${badge.className}`}
                    title="この数値の測定方法"
                  >
                    <span>{badge.icon}</span>
                    {badge.label}
                  </span>
                </div>
              );
            })()}
            {adjustedCentering && (
              <div className="flex items-center justify-between mb-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span className="text-xs text-green-800 font-medium">✅ 手動調整値を表示中</span>
                <button
                  onClick={() => { setAdjustedCentering(null); if (activeOverlay === "__adjusted__") setActiveOverlay(null); }}
                  className="text-xs text-green-700 underline hover:text-green-900"
                >
                  AI値に戻す
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <DataItem
                label="左右比率"
                value={adjustedCentering ? adjustedCentering.lr_ratio : String(result.sub_grades.centering.detail.lr_ratio)}
              />
              <DataItem
                label="上下比率"
                value={adjustedCentering ? adjustedCentering.tb_ratio : String(result.sub_grades.centering.detail.tb_ratio)}
              />
              <DataItem
                label="左ボーダー"
                value={`${adjustedCentering ? adjustedCentering.left_border : result.sub_grades.centering.detail.left_border}px`}
              />
              <DataItem
                label="右ボーダー"
                value={`${adjustedCentering ? adjustedCentering.right_border : result.sub_grades.centering.detail.right_border}px`}
              />
              <DataItem
                label="上ボーダー"
                value={`${adjustedCentering ? adjustedCentering.top_border : result.sub_grades.centering.detail.top_border}px`}
              />
              <DataItem
                label="下ボーダー"
                value={`${adjustedCentering ? adjustedCentering.bottom_border : result.sub_grades.centering.detail.bottom_border}px`}
              />
            </div>

            {/* 手動調整グレード判定 */}
            {adjustedCentering && (
              <div className="mt-3">
                <div className="text-xs font-medium text-gray-500 mb-1.5">調整後の鑑定機関別判定</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {adjustedCentering.grades.map((g) => (
                    <div
                      key={g.name}
                      className={`text-center py-1 px-1 rounded text-xs font-medium ${
                        g.pass
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-red-50 text-red-400 border border-red-100 line-through"
                      }`}
                    >
                      {g.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* センタリング手動調整ボタン */}
            {!editingCentering && (
              <button
                onClick={() => { setEditingCentering(true); setActiveOverlay(null); }}
                className="mt-3 w-full py-2 rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-medium transition-colors"
              >
                🎯 センタリングを手動調整
              </button>
            )}

            {/* インラインCenteringEditor */}
            {editingCentering && (
              <div className="mt-4 border-t pt-4">
                <CenteringEditor
                  imageSrc={imageSrc(result.card_image)}
                  onComplete={(r) => {
                    setAdjustedCentering(r);
                    setEditingCentering(false);
                    setActiveOverlay("__adjusted__");
                    // 手動確定値を永続化（リロード後の復元 + AI差分分析の教師データ / P1-5）
                    if (result.id) {
                      saveManualCentering(result.id, r).catch((e) =>
                        console.error("手動調整値の保存に失敗:", e)
                      );
                    }
                  }}
                  onSkip={() => setEditingCentering(false)}
                  initialBorders={{
                    left:   Number(result.sub_grades.centering.detail.left_border)   || 0,
                    right:  Number(result.sub_grades.centering.detail.right_border)  || 0,
                    top:    Number(result.sub_grades.centering.detail.top_border)    || 0,
                    bottom: Number(result.sub_grades.centering.detail.bottom_border) || 0,
                  }}
                  submitLabel="この位置で確定"
                  skipLabel="キャンセル"
                />
              </div>
            )}
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

      {/* 裏面解析 (1ショットで処理済) */}
      {result.back_analysis && !result.back_analysis.error ? (
        <BackAnalysisSection
          back={result.back_analysis}
          frontCentering={{
            lr_ratio: result.sub_grades.centering.detail.lr_ratio as string | undefined,
            tb_ratio: result.sub_grades.centering.detail.tb_ratio as string | undefined,
          }}
        />
      ) : hasBackImage && result.back_analysis?.error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠️ 裏面の解析に失敗しました: {result.back_analysis.error}
        </div>
      ) : (
        <NoBackImageWarning />
      )}

      {/* 価格DB（販売・買取の中央値） */}
      {cardCode && <CardPriceSummary code={cardCode} />}
    </div>
  );
}

function BackAnalysisSection({
  back,
  frontCentering,
}: {
  back: NonNullable<GradeResult["back_analysis"]>;
  frontCentering: { lr_ratio?: string; tb_ratio?: string };
}) {
  const [showOverlay, setShowOverlay] = useState(false);
  const lr = String(back.centering.detail.lr_ratio ?? "50/50");
  const tb = String(back.centering.detail.tb_ratio ?? "50/50");

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        📐 裏面の解析
        <span className="text-xs text-gray-500 font-normal">
          (センタリング測定)
        </span>
      </h2>
      <p className="text-xs text-gray-600 mb-4">
        裏面のセンタリング測定結果です。PSA等では <strong>表裏のうち悪い方</strong> が採用されるため、両面の確認が重要です。
      </p>

      {/* 裏面画像 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setShowOverlay(false)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              !showOverlay ? "bg-gray-900 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            裏面画像
          </button>
          <button
            onClick={() => setShowOverlay(true)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              showOverlay ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            センタリング解析
          </button>
        </div>
        <div className="flex justify-center">
          <img
            src={imageSrc(showOverlay ? back.centering_overlay : back.card_image)}
            alt={showOverlay ? "裏面センタリング解析" : "裏面"}
            className="max-h-[400px] rounded-lg shadow"
          />
        </div>
      </div>

      {/* 比較ブロック */}
      {frontCentering.lr_ratio && frontCentering.tb_ratio ? (
        <div className="border rounded-lg p-3 bg-blue-50 mb-3">
          <div className="text-xs font-medium text-blue-900 mb-2">
            ⚖️ 表裏センタリングの比較
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="text-gray-500 text-[10px]">表面</div>
              <div className="font-medium">
                {frontCentering.lr_ratio} / {frontCentering.tb_ratio}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-[10px]">裏面</div>
              <div className="font-medium">{lr} / {tb}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-[10px]">採用 (悪い方)</div>
              <div className="font-bold text-blue-700">
                {worstRatio(frontCentering.lr_ratio, lr)} /{" "}
                {worstRatio(frontCentering.tb_ratio, tb)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-center bg-gray-50 rounded-lg p-3 mb-3">
          <div>
            <div className="text-xs text-gray-500">裏面 左右</div>
            <div className={`text-2xl font-bold ${ratioColor(lr)}`}>{lr}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">裏面 上下</div>
            <div className={`text-2xl font-bold ${ratioColor(tb)}`}>{tb}</div>
          </div>
        </div>
      )}

      <div className="text-[11px] text-gray-500">
        ※ 白かけ・角欠け・エッジ傷の自動検出は、裏面の均一パターン上では精度が低いため、目視確認 (拡大画像) を推奨します。
      </div>
    </div>
  );
}

function NoBackImageWarning() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
      <div className="font-semibold mb-1">⚠️ 裏面未確認</div>
      <ul className="list-disc list-inside space-y-0.5 text-xs leading-snug">
        <li>裏面画像が登録されていないため、<strong>白かけ・角欠け・エッジ傷</strong>は確認できません。</li>
        <li>裏面センタリングは PSA/BGS 鑑定で評価対象です。表裏のうち悪い方が採用されます。</li>
        <li>PSA提出前・美品仕入れ判断には、裏面画像を含めた再チェックを推奨します。</li>
      </ul>
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
