"use client";

import { useState, useCallback } from "react";
import { preprocessImage } from "../../lib/api";
import CenteringEditor from "./CenteringEditor";
import CameraCapture from "../camera/CameraCapture";

type Mode = "idle" | "preprocessing" | "editing" | "done";

interface BackResult {
  lr_ratio: string;
  tb_ratio: string;
  left_border: number;
  right_border: number;
  top_border: number;
  bottom_border: number;
  grades: Array<{ name: string; pass: boolean }>;
}

interface Props {
  frontCentering?: {
    lr_ratio?: string;
    tb_ratio?: string;
  };
}

function worstRatio(a: string, b: string): string {
  // "55/45" 形式の文字列から大きい方を取り出して比較
  const big = (s: string) => {
    const [x, y] = s.split("/").map((n) => parseInt(n, 10));
    return Math.max(x || 0, y || 0);
  };
  return big(a) >= big(b) ? a : b;
}

export default function BackSideCentering({ frontCentering }: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [correctedImage, setCorrectedImage] = useState<string | null>(null);
  const [outerBox, setOuterBox] = useState<{ left: number; right: number; top: number; bottom: number } | null>(null);
  const [result, setResult] = useState<BackResult | null>(null);

  const reset = () => {
    setMode("idle");
    setError(null);
    setCorrectedImage(null);
    setOuterBox(null);
    setResult(null);
  };

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    setMode("preprocessing");
    try {
      const pre = await preprocessImage(f);
      setCorrectedImage(`data:image/jpeg;base64,${pre.card_image}`);
      setOuterBox(pre.outer_box ?? null);
      setMode("editing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "前処理に失敗しました");
      setMode("idle");
    }
  }, []);

  const handleComplete = (r: Record<string, unknown>) => {
    setResult({
      lr_ratio: String(r.lr_ratio),
      tb_ratio: String(r.tb_ratio),
      left_border: Number(r.left_border),
      right_border: Number(r.right_border),
      top_border: Number(r.top_border),
      bottom_border: Number(r.bottom_border),
      grades: (r.grades as BackResult["grades"]) || [],
    });
    setMode("done");
  };

  const ratioColor = (ratio: string) => {
    const big = parseInt(ratio.split("/")[0], 10);
    if (big <= 55) return "text-green-600";
    if (big <= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      {cameraOpen && (
        <CameraCapture
          onCapture={(f) => {
            setCameraOpen(false);
            handleFile(f);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          📐 裏面センタリング
          <span className="text-xs text-gray-500 font-normal">(任意)</span>
        </h2>
        {mode !== "idle" && (
          <button
            onClick={reset}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            ↺ やり直し
          </button>
        )}
      </div>

      <p className="text-xs text-gray-600 mb-4">
        PSA等の鑑定では表裏両方のセンタリングが評価されます。裏面の写真もアップロードして測定すると、より正確なグレード予想が得られます。
      </p>

      {mode === "idle" && (
        <div className="space-y-3">
          <label className="block">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              id="back-file-input"
            />
            <button
              type="button"
              onClick={() => document.getElementById("back-file-input")?.click()}
              className="w-full py-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-sm text-gray-600 transition-colors"
            >
              📷 裏面の画像をアップロード
            </button>
          </label>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="w-full py-2.5 rounded-lg border-2 border-blue-500 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            📸 カメラで撮影 (枠ガイド・水平表示付き)
          </button>
        </div>
      )}

      {mode === "preprocessing" && (
        <div className="text-center py-8">
          <span className="animate-spin inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full" />
          <p className="text-sm text-gray-600 mt-3">画像を正面化中...</p>
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {mode === "editing" && correctedImage && (
        <CenteringEditor
          imageSrc={correctedImage}
          onComplete={(r) => handleComplete(r as unknown as Record<string, unknown>)}
          onSkip={() => {
            // 自動検出で完結 (外枠/内枠デフォルトで計算済の値を確定)
            const r = {
              lr_ratio: "50/50",
              tb_ratio: "50/50",
              left_border: 0,
              right_border: 0,
              top_border: 0,
              bottom_border: 0,
              grades: [],
            };
            handleComplete(r);
          }}
          fullartMode={false}
          cardKind="character"
          initialOuter={outerBox}
        />
      )}

      {mode === "done" && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-center bg-gray-50 rounded-lg p-4">
            <div>
              <div className="text-xs text-gray-500">裏面 左右</div>
              <div className={`text-2xl font-bold ${ratioColor(result.lr_ratio)}`}>
                {result.lr_ratio}
              </div>
              <div className="text-[11px] text-gray-400">
                L:{result.left_border}px / R:{result.right_border}px
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">裏面 上下</div>
              <div className={`text-2xl font-bold ${ratioColor(result.tb_ratio)}`}>
                {result.tb_ratio}
              </div>
              <div className="text-[11px] text-gray-400">
                T:{result.top_border}px / B:{result.bottom_border}px
              </div>
            </div>
          </div>

          {/* 表面と比較 */}
          {frontCentering?.lr_ratio && frontCentering?.tb_ratio && (
            <div className="border rounded-lg p-3 bg-blue-50">
              <div className="text-xs font-medium text-blue-900 mb-2">
                ⚖️ 表裏センタリングの比較 (PSAは悪い方を採用)
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-gray-500 text-[10px]">表面</div>
                  <div className="font-medium">{frontCentering.lr_ratio} / {frontCentering.tb_ratio}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500 text-[10px]">裏面</div>
                  <div className="font-medium">{result.lr_ratio} / {result.tb_ratio}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500 text-[10px]">採用 (悪い方)</div>
                  <div className="font-bold text-blue-700">
                    {worstRatio(frontCentering.lr_ratio, result.lr_ratio)} /{" "}
                    {worstRatio(frontCentering.tb_ratio, result.tb_ratio)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {result.grades.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">
                裏面ベースで通る鑑定グレード
              </div>
              <div className="grid grid-cols-3 gap-2">
                {result.grades.map((g) => (
                  <div
                    key={g.name}
                    className={`text-center py-1.5 px-2 rounded text-xs font-medium ${
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
        </div>
      )}
    </div>
  );
}
