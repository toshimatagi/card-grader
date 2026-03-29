"use client";

import { useState, useCallback, useEffect } from "react";
import { gradeCard, getBrands, GradeResult, Brand } from "../lib/api";
import GradeResultView from "../components/result/GradeResultView";
import CenteringEditor from "../components/centering/CenteringEditor";

type AppStep = "upload" | "centering" | "result";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState<AppStep>("upload");
  const [manualCentering, setManualCentering] = useState<Record<string, unknown> | null>(null);

  // ブランド・レアリティ選択
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedRarity, setSelectedRarity] = useState("");
  const [cardName, setCardName] = useState("");

  useEffect(() => {
    getBrands().then(setBrands).catch(() => {});
  }, []);

  const currentBrand = brands.find((b) => b.id === selectedBrand);
  const cardType = currentBrand?.size === "small" ? "small" : "standard";

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

  // 「鑑定開始」ボタン → センタリングエディターへ
  const handleSubmit = () => {
    if (!file) return;
    setStep("centering");
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStep("upload");
    setManualCentering(null);
  };

  // センタリングエディターからの結果で鑑定開始
  const handleCenteringComplete = async (centeringResult: Record<string, unknown>) => {
    setManualCentering(centeringResult);
    if (!file) return;
    setLoading(true);
    setError(null);
    setStep("result");
    try {
      const res = await gradeCard(file, cardType, selectedBrand, selectedRarity, centeringResult);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setStep("centering");
    } finally {
      setLoading(false);
    }
  };

  // 自動検出で鑑定（センタリングエディターをスキップ）
  const handleSkipCentering = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setStep("result");
    try {
      const res = await gradeCard(file, cardType, selectedBrand, selectedRarity);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  const brandIcons: Record<string, string> = {
    pokemon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png",
    onepiece: "",
    dragonball_fw: "",
    yugioh: "",
  };

  const brandEmojis: Record<string, string> = {
    pokemon: "⚡",
    onepiece: "🏴‍☠️",
    dragonball_fw: "🐉",
    yugioh: "🃏",
  };

  return (
    <div>
      {/* Step 2: センタリングエディター */}
      {step === "centering" && preview && (
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setStep("upload")}
            className="mb-4 text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
          >
            ← 戻る
          </button>
          <CenteringEditor
            imageSrc={preview}
            onComplete={(r) => handleCenteringComplete(r as unknown as Record<string, unknown>)}
            onSkip={handleSkipCentering}
          />
          {loading && (
            <div className="mt-4 text-center">
              <span className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
              <p className="text-sm text-gray-600 mt-2">鑑定中...</p>
            </div>
          )}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Step 1: アップロード */}
      {step === "upload" ? (
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

          {/* ブランド選択 */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              カードブランド
            </label>
            <div className="grid grid-cols-2 gap-3">
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => {
                    setSelectedBrand(brand.id);
                    setSelectedRarity("");
                  }}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    selectedBrand === brand.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{brandEmojis[brand.id] || "🎴"}</span>
                    <div>
                      <div className="font-medium text-sm">{brand.name_ja}</div>
                      <div className="text-xs text-gray-500">
                        {brand.size === "small" ? "59x86mm" : "63x88mm"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* レアリティ選択 */}
          {currentBrand && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                レアリティ
              </label>
              <div className="flex flex-wrap gap-2">
                {currentBrand.rarities.map((r) => {
                  const isBorderless = !r.has_border;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRarity(r.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                        selectedRarity === r.id
                          ? "border-blue-500 bg-blue-100 text-blue-800"
                          : isBorderless
                          ? "border-purple-300 bg-purple-50 text-purple-700 hover:border-purple-400"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {r.name_ja}
                      {isBorderless && (
                        <span className="ml-1 text-purple-500" title="フルアート/ボーダーレス">★</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedRarity && currentBrand.rarities.find(r => r.id === selectedRarity) && (
                <div className="mt-2 text-xs text-gray-500">
                  {(() => {
                    const r = currentBrand.rarities.find(r => r.id === selectedRarity);
                    if (!r) return null;
                    const tags = [];
                    if (!r.has_border) tags.push("ボーダーレス");
                    else if (r.border_type === "gold") tags.push("金ボーダー");
                    else if (r.border_type === "silver") tags.push("銀ボーダー");
                    else if (r.border_type === "thin") tags.push("薄ボーダー");
                    else tags.push("標準ボーダー");
                    if (r.surface_type === "holo") tags.push("ホロ");
                    else if (r.surface_type === "textured") tags.push("テクスチャ加工");
                    else if (r.surface_type === "gold") tags.push("ゴールド加工");
                    else if (r.surface_type === "reverse_holo") tags.push("リバースホロ");
                    return `分析モード: ${tags.join(" / ")}`;
                  })()}
                </div>
              )}
            </div>
          )}

          {/* カード名入力 */}
          {selectedBrand && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                カード名（eBay価格検索用・任意）
              </label>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder={
                  selectedBrand === "pokemon" ? "例: リザードン SAR SV6-103" :
                  selectedBrand === "onepiece" ? "例: ナミ OP09-050 SR" :
                  selectedBrand === "yugioh" ? "例: ブラック・マジシャン QCSE-JP001" :
                  "例: カード名 セット番号"
                }
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">
                入力するとeBayの最近のSold価格を表示します
              </p>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* 鑑定ボタン */}
          <button
            onClick={handleSubmit}
            disabled={!file || loading || !selectedBrand}
            className={`mt-6 w-full py-3 rounded-lg font-medium text-white transition-colors ${
              !file || loading || !selectedBrand
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                鑑定中...
              </span>
            ) : !selectedBrand ? (
              "ブランドを選択してください"
            ) : (
              "鑑定開始"
            )}
          </button>
        </div>
      ) : step === "result" && result ? (
        <div>
          <button
            onClick={resetForm}
            className="mb-6 text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
          >
            ← 新しいカードを鑑定
          </button>
          <GradeResultView result={result} cardName={cardName} brand={selectedBrand} />
        </div>
      ) : step === "result" && loading ? (
        <div className="max-w-2xl mx-auto text-center py-20">
          <span className="animate-spin inline-block w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full" />
          <p className="text-gray-600 mt-4">鑑定中...</p>
        </div>
      ) : null}
    </div>
  );
}
