"use client";

import { useState, useCallback, useEffect } from "react";
import { gradeCard, getBrands, preprocessImage, identifyCard, GradeResult, Brand, CardSummary, IdentifyCardResult } from "../../lib/api";
import GradeResultView from "../result/GradeResultView";
import CenteringEditor from "../centering/CenteringEditor";
import CardNameAutocomplete from "../cards/CardNameAutocomplete";
import CameraCapture from "../camera/CameraCapture";

type AppStep = "upload" | "centering" | "result";

export default function GradeApp() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState<AppStep>("upload");
  const [manualCentering, setManualCentering] = useState<Record<string, unknown> | null>(null);
  const [correctedImage, setCorrectedImage] = useState<string | null>(null);
  const [outerBox, setOuterBox] = useState<{ left: number; right: number; top: number; bottom: number } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  // ブランド・レアリティ選択
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedRarity, setSelectedRarity] = useState("");
  const [cardName, setCardName] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCardCode, setSelectedCardCode] = useState<string | null>(null);

  // AI識別 (Gemini)
  const [identifying, setIdentifying] = useState(false);
  const [identifyResult, setIdentifyResult] = useState<IdentifyCardResult | null>(null);
  const [identifyError, setIdentifyError] = useState<string | null>(null);

  useEffect(() => {
    getBrands().then(setBrands).catch(() => {});
  }, []);

  const currentBrand = brands.find((b) => b.id === selectedBrand);
  const cardType = currentBrand?.size === "small" ? "small" : "standard";

  const runIdentify = useCallback(async (f: File) => {
    setIdentifying(true);
    setIdentifyError(null);
    setIdentifyResult(null);
    try {
      const res = await identifyCard(f);
      if ("error" in res) {
        setIdentifyError(res.error);
        return;
      }
      setIdentifyResult(res);
      // 自動セット (確度 0.4 以上 + マッチあり)
      if (res.code && res.confidence >= 0.4 && res.matched.length > 0) {
        const m = res.matched[0];
        setSelectedCardId(m.id);
        setSelectedCardCode(`${m.set_code}-${m.card_no}`);
        setCardName(`${m.name_ja} ${m.set_code}-${m.card_no} ${m.rarity}`);
      }
    } catch (e) {
      setIdentifyError(e instanceof Error ? e.message : "識別失敗");
    } finally {
      setIdentifying(false);
    }
  }, []);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
    // 画像が来たらAIで型番・名前を抽出 (バックグラウンド)
    runIdentify(f);
  }, [runIdentify]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) handleFile(f);
    },
    [handleFile]
  );

  // 「鑑定開始」ボタン → 正面化API → センタリングエディターへ
  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const preprocessed = await preprocessImage(file);
      setCorrectedImage(`data:image/jpeg;base64,${preprocessed.card_image}`);
      setOuterBox(preprocessed.outer_box ?? null);
      setStep("centering");
    } catch (e) {
      setError(e instanceof Error ? e.message : "前処理に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStep("upload");
    setManualCentering(null);
    setCorrectedImage(null);
    setOuterBox(null);
    setSelectedCardId(null);
    setSelectedCardCode(null);
    setIdentifyResult(null);
    setIdentifyError(null);
  };

  const handlePickCard = (c: CardSummary) => {
    setSelectedCardId(c.id);
    setSelectedCardCode(`${c.set_code}-${c.card_no}`);
    setCardName(`${c.name_ja} ${c.set_code}-${c.card_no} ${c.rarity}`);
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
      {cameraOpen && (
        <CameraCapture
          onCapture={(f) => {
            handleFile(f);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {/* Step 2: センタリングエディター */}
      {step === "centering" && (correctedImage || preview) && (
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setStep("upload")}
            className="mb-4 text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
          >
            ← 戻る
          </button>
          <CenteringEditor
            imageSrc={correctedImage || preview!}
            onComplete={(r) => handleCenteringComplete(r as unknown as Record<string, unknown>)}
            onSkip={handleSkipCentering}
            fullartMode={(() => {
              const r = currentBrand?.rarities.find((x) => x.id === selectedRarity);
              return !!r && (!r.has_border || r.border_type === "none");
            })()}
            cardKind={selectedRarity === "l" ? "leader" : "character"}
            initialOuter={outerBox}
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
          <div className="text-center mb-6" id="grade">
            <h2 className="text-2xl font-bold mb-1">📸 鑑定する</h2>
            <p className="text-sm text-gray-600">
              カード画像をアップロードまたは撮影
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

          {/* カメラで撮影ボタン (主にスマホ向け、PCでも内蔵カメラで動作) */}
          {!preview && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCameraOpen(true);
              }}
              className="mt-3 w-full py-3 rounded-lg border-2 border-blue-500 text-blue-600 font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              📷 カメラで撮影 (枠ガイド・水平表示付き)
            </button>
          )}

          {/* AI識別結果 */}
          {preview && (identifying || identifyResult || identifyError) && (
            <div className="mt-3 p-3 rounded-lg border bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              {identifying && (
                <div className="flex items-center gap-2 text-sm text-purple-700">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full" />
                  🤖 AI でカードを識別中...
                </div>
              )}
              {!identifying && identifyError && (
                <div className="flex items-start gap-2 text-xs text-orange-700">
                  <span>⚠️</span>
                  <div>
                    自動識別できませんでした (手動入力で続行できます)
                    <button
                      onClick={() => file && runIdentify(file)}
                      className="ml-2 underline"
                    >
                      再試行
                    </button>
                  </div>
                </div>
              )}
              {!identifying && identifyResult && !identifyError && (
                <div className="text-sm">
                  {identifyResult.matched.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-purple-700 font-bold">🤖 AI識別:</span>
                        <span className="font-medium">
                          {identifyResult.name_ja} ({identifyResult.code})
                        </span>
                        <span className="text-xs text-gray-500">
                          確度 {Math.round(identifyResult.confidence * 100)}%
                        </span>
                      </div>
                      {identifyResult.matched.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-xs text-gray-600 self-center">
                            バリアント:
                          </span>
                          {identifyResult.matched.map((m) => {
                            const isPicked = selectedCardId === m.id;
                            return (
                              <button
                                key={m.id}
                                onClick={() => {
                                  setSelectedCardId(m.id);
                                  setSelectedCardCode(`${m.set_code}-${m.card_no}`);
                                  setCardName(`${m.name_ja} ${m.set_code}-${m.card_no} ${m.rarity}`);
                                }}
                                className={`px-2 py-1 text-xs rounded border ${
                                  isPicked
                                    ? "bg-purple-600 text-white border-purple-600"
                                    : "bg-white text-purple-700 border-purple-300 hover:bg-purple-50"
                                }`}
                              >
                                {m.variant} / {m.rarity}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-gray-600">
                      🤖 型番を読み取れませんでした (手動で型番を入れるか、撮り直してください)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

          {/* カード名・型番入力 */}
          {selectedBrand && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                カード（型番または名前で検索・任意）
              </label>
              {selectedBrand === "onepiece" ? (
                <CardNameAutocomplete
                  value={cardName}
                  onChange={(v) => {
                    setCardName(v);
                    setSelectedCardId(null);
                    setSelectedCardCode(null);
                  }}
                  onSelect={handlePickCard}
                  brand={selectedBrand}
                  placeholder="例: ナミ または OP09-050"
                />
              ) : (
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder={
                    selectedBrand === "pokemon" ? "例: リザードン SAR SV6-103" :
                    selectedBrand === "yugioh" ? "例: ブラック・マジシャン QCSE-JP001" :
                    "例: カード名 セット番号"
                  }
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                />
              )}
              <p className="mt-1 text-xs text-gray-400">
                {selectedBrand === "onepiece"
                  ? "型番(OP09-050)または名前で検索 → 候補から選択"
                  : "入力するとeBayの最近のSold価格を表示します"}
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

          {/* 価格DB / 値上がりへの動線 */}
          <div className="mt-10 pt-8 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-3 text-center">他の機能</p>
            <div className="grid grid-cols-2 gap-3">
              <a
                href="/cards"
                className="block border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <div className="text-2xl mb-1">📚</div>
                <div className="font-bold text-sm">カード価格DB</div>
                <div className="text-xs text-gray-500 mt-1">
                  全カードの最新相場 (中央値)
                </div>
              </a>
              <a
                href="/trending"
                className="block border border-gray-200 rounded-lg p-4 hover:border-red-400 hover:bg-red-50 transition-colors"
              >
                <div className="text-2xl mb-1">📈</div>
                <div className="font-bold text-sm">値上がりランキング</div>
                <div className="text-xs text-gray-500 mt-1">
                  24h / 7日 / 30日の騰落率
                </div>
              </a>
            </div>
          </div>
        </div>
      ) : step === "result" && result ? (
        <div>
          <button
            onClick={resetForm}
            className="mb-6 text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
          >
            ← 新しいカードを鑑定
          </button>
          <GradeResultView
            result={result}
            cardName={cardName}
            brand={selectedBrand}
            cardCode={selectedCardCode ?? undefined}
          />
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
