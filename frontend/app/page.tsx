"use client";

import { useState, useCallback } from "react";
import { gradeCard, GradeResult } from "../lib/api";
import GradeResultView from "../components/result/GradeResultView";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cardType, setCardType] = useState("standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) handleFile(f);
    },
    [handleFile]
  );

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await gradeCard(file, cardType);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div>
      {!result ? (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">カード鑑定</h1>
            <p className="text-gray-600">
              カードの画像をアップロードして、自動鑑定を行います
            </p>
          </div>

          {/* アップロードエリア */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            {preview ? (
              <div className="space-y-4">
                <img
                  src={preview}
                  alt="プレビュー"
                  className="max-h-80 mx-auto rounded-lg shadow-md"
                />
                <p className="text-sm text-gray-500">{file?.name}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resetForm();
                  }}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  画像を変更
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-5xl">📸</div>
                <p className="text-lg font-medium">
                  カード画像をドラッグ&ドロップ
                </p>
                <p className="text-sm text-gray-500">
                  またはクリックしてファイルを選択
                </p>
                <p className="text-xs text-gray-400">
                  JPEG / PNG / WebP (推奨: 1000x1400px以上)
                </p>
              </div>
            )}
          </div>

          {/* カードタイプ選択 */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              カードタイプ
            </label>
            <div className="flex gap-3">
              {[
                { value: "standard", label: "スタンダード", desc: "63x88mm (ポケカ/MTG)" },
                { value: "small", label: "スモール", desc: "59x86mm (遊戯王)" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCardType(opt.value)}
                  className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
                    cardType === opt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-500">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* 鑑定ボタン */}
          <button
            onClick={handleSubmit}
            disabled={!file || loading}
            className={`mt-6 w-full py-3 rounded-lg font-medium text-white transition-colors ${
              !file || loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                鑑定中...
              </span>
            ) : (
              "鑑定開始"
            )}
          </button>
        </div>
      ) : (
        <div>
          <button
            onClick={resetForm}
            className="mb-6 text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
          >
            ← 新しいカードを鑑定
          </button>
          <GradeResultView result={result} />
        </div>
      )}
    </div>
  );
}
