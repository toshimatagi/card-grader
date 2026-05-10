"use client";

import { useState, useCallback, useEffect } from "react";
import { gradeCard, getBrands, preprocessImage, identifyCard, GradeResult, Brand, CardSummary, IdentifyCardResult, CornerPoints } from "../../lib/api";
import GradeResultView from "../result/GradeResultView";
import CenteringEditor from "../centering/CenteringEditor";
import PerspectiveEditor from "../centering/PerspectiveEditor";
import CardNameAutocomplete from "../cards/CardNameAutocomplete";
import CameraCapture from "../camera/CameraCapture";

type AppStep = "upload" | "centering_front" | "centering_back" | "result";
type CameraTarget = "front" | "back" | null;

export default function GradeApp() {
  // 表面
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [manualCentering, setManualCentering] = useState<Record<string, unknown> | null>(null);
  const [correctedImage, setCorrectedImage] = useState<string | null>(null);
  const [outerBox, setOuterBox] = useState<{ left: number; right: number; top: number; bottom: number } | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [originalCorners, setOriginalCorners] = useState<CornerPoints | null>(null);
  const [originalSize, setOriginalSize] = useState<{ w: number; h: number } | null>(null);

  // 裏面 (任意)
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [backManualCentering, setBackManualCentering] = useState<Record<string, unknown> | null>(null);
  const [backCorrectedImage, setBackCorrectedImage] = useState<string | null>(null);
  const [backOuterBox, setBackOuterBox] = useState<{ left: number; right: number; top: number; bottom: number } | null>(null);
  const [backOriginalImage, setBackOriginalImage] = useState<string | null>(null);
  const [backOriginalCorners, setBackOriginalCorners] = useState<CornerPoints | null>(null);
  const [backOriginalSize, setBackOriginalSize] = useState<{ w: number; h: number } | null>(null);
  // 裏面の手動正面化が確定した時だけセット。null なら raw 画像で測定する。
  const [backWarpCorners, setBackWarpCorners] = useState<CornerPoints | null>(null);

  // 4点傾き調整 UI 表示中か (front/back/null)
  const [perspectiveTarget, setPerspectiveTarget] = useState<"front" | "back" | null>(null);
  const [perspectiveLoading, setPerspectiveLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [dragActive, setDragActive] = useState<"front" | "back" | null>(null);
  const [step, setStep] = useState<AppStep>("upload");
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>(null);
  // 画像のソース (camera = 自動撮影で枠合わせ済み, upload = アップロード/D&D)
  // camera 由来は既に枠合わせ済みなので auto-warp を適用しない
  // (誤検出で画像が引き延ばされるのを防ぐ)
  const [frontSource, setFrontSource] = useState<"camera" | "upload">("upload");
  const [backSource, setBackSource] = useState<"camera" | "upload">("upload");

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

  const handleFile = useCallback((f: File, source: "camera" | "upload" = "upload") => {
    setFile(f);
    setFrontSource(source);
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
    runIdentify(f);
  }, [runIdentify]);

  const handleBackFile = useCallback((f: File, source: "camera" | "upload" = "upload") => {
    setBackFile(f);
    setBackSource(source);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setBackPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleDropFront = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(null);
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) handleFile(f);
    },
    [handleFile]
  );

  const handleDropBack = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(null);
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) handleBackFile(f);
    },
    [handleBackFile]
  );

  // 「鑑定開始」ボタン → 表+(裏)を一括 preprocess → 表面のセンタリングへ
  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const tasks: Promise<unknown>[] = [
        preprocessImage(file).then((pre) => {
          // camera 由来は枠合わせ済なので auto-warp で引き延ばされるのを避け
          // raw 原画像を表示する。upload 由来 (D&D 等) は従来通り auto-warp 結果。
          if (frontSource === "camera") {
            setCorrectedImage(`data:image/jpeg;base64,${pre.original_image}`);
            setOuterBox(null);
          } else {
            setCorrectedImage(`data:image/jpeg;base64,${pre.card_image}`);
            setOuterBox(pre.outer_box ?? null);
          }
          setOriginalImage(pre.original_image);
          setOriginalCorners(pre.original_corners);
          setOriginalSize(pre.original_size);
        }),
      ];
      if (backFile) {
        tasks.push(
          preprocessImage(backFile).then((pre) => {
            // 裏面はパターンが均一で auto-corner-detection が外しやすく、
            // 表面と同じく auto-warp で引き延ばされるため、既定では warp を
            // 適用せず raw 原画像を表示。手動で「傾き調整」を実行した時だけ
            // 正面化結果に切り替える。
            setBackCorrectedImage(`data:image/jpeg;base64,${pre.original_image}`);
            setBackOuterBox(null);
            setBackOriginalImage(pre.original_image);
            setBackOriginalCorners(pre.original_corners);
            setBackOriginalSize(pre.original_size);
          })
        );
      }
      await Promise.all(tasks);
      setStep("centering_front");
    } catch (e) {
      setError(e instanceof Error ? e.message : "前処理に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 4点 corners 確定 → 再 preprocess → 補正画像を更新
  const handlePerspectiveConfirm = async (corners: CornerPoints) => {
    const target = perspectiveTarget;
    if (!target) return;
    const targetFile = target === "front" ? file : backFile;
    if (!targetFile) return;
    setPerspectiveLoading(true);
    setError(null);
    try {
      const pre = await preprocessImage(targetFile, corners);
      if (target === "front") {
        setCorrectedImage(`data:image/jpeg;base64,${pre.card_image}`);
        setOuterBox(pre.outer_box ?? null);
        setOriginalCorners(pre.original_corners);
      } else {
        setBackCorrectedImage(`data:image/jpeg;base64,${pre.card_image}`);
        setBackOuterBox(pre.outer_box ?? null);
        setBackOriginalCorners(pre.original_corners);
        // 手動で正面化が確定した → backend にも同じ corners で warp させる
        setBackWarpCorners(corners);
      }
      setPerspectiveTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "再正面化に失敗しました");
    } finally {
      setPerspectiveLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setBackFile(null);
    setBackPreview(null);
    setResult(null);
    setError(null);
    setStep("upload");
    setManualCentering(null);
    setBackManualCentering(null);
    setCorrectedImage(null);
    setBackCorrectedImage(null);
    setOuterBox(null);
    setBackOuterBox(null);
    setOriginalImage(null);
    setOriginalCorners(null);
    setOriginalSize(null);
    setBackOriginalImage(null);
    setBackOriginalCorners(null);
    setBackOriginalSize(null);
    setBackWarpCorners(null);
    setPerspectiveTarget(null);
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

  // grade API を1回叩いて結果取得
  const submitGrade = async (
    frontCentering: Record<string, unknown> | null,
    backCentering: Record<string, unknown> | null,
  ) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setStep("result");
    try {
      const res = await gradeCard(
        file,
        cardType,
        selectedBrand,
        selectedRarity,
        frontCentering ?? undefined,
        backFile ?? undefined,
        backCentering ?? undefined,
      );
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setStep(backFile ? "centering_back" : "centering_front");
    } finally {
      setLoading(false);
    }
  };

  // 表面センタリング完了 → 裏あれば裏面ステップへ、無ければ即grade
  const handleFrontCenteringComplete = async (centeringResult: Record<string, unknown>) => {
    setManualCentering(centeringResult);
    if (backFile) {
      setStep("centering_back");
    } else {
      await submitGrade(centeringResult, null);
    }
  };

  // 表面センタリング自動 (スキップ)
  const handleFrontSkipCentering = async () => {
    setManualCentering(null);
    if (backFile) {
      setStep("centering_back");
    } else {
      await submitGrade(null, null);
    }
  };

  // 裏面の payload に warp_corners を merge して、backend と座標系を合わせる。
  // backWarpCorners が null = raw 画像で測定 (backend も raw を使う)
  // backWarpCorners が set = 手動 warp 済 (backend も同じ corners で warp する)
  const mergeBackWarp = (
    centering: Record<string, unknown> | null,
  ): Record<string, unknown> | null => {
    if (!backWarpCorners) return centering;
    const base = centering ?? {};
    return { ...base, warp_corners: backWarpCorners };
  };

  // 裏面センタリング完了 → grade
  const handleBackCenteringComplete = async (centeringResult: Record<string, unknown>) => {
    const payload = mergeBackWarp(centeringResult);
    setBackManualCentering(payload);
    await submitGrade(manualCentering, payload);
  };

  // 裏面センタリング自動 (スキップ)
  const handleBackSkipCentering = async () => {
    const payload = mergeBackWarp(null);
    setBackManualCentering(payload);
    await submitGrade(manualCentering, payload);
  };

  const brandEmojis: Record<string, string> = {
    pokemon: "⚡",
    onepiece: "🏴‍☠️",
    dragonball_fw: "🐉",
    yugioh: "🃏",
  };

  return (
    <div>
      {cameraTarget !== null && (
        <CameraCapture
          onCapture={(f) => {
            if (cameraTarget === "front") {
              handleFile(f, "camera");
            } else if (cameraTarget === "back") {
              handleBackFile(f, "camera");
            }
            setCameraTarget(null);
          }}
          onClose={() => setCameraTarget(null)}
        />
      )}

      {/* Step 2a: 表面センタリングエディター */}
      {step === "centering_front" && (correctedImage || preview) && (
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setStep("upload")}
            className="mb-2 text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
          >
            ← 戻る
          </button>
          <div className="mb-3 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                {backFile ? "1 / 2" : "1 / 1"}
              </span>
              <span className="font-medium text-gray-700">表面のセンタリング測定</span>
            </div>
            {originalImage && originalCorners && originalSize && (
              <button
                type="button"
                onClick={() => setPerspectiveTarget("front")}
                className="px-2.5 py-1 rounded-full text-[11px] border border-blue-400 text-blue-700 bg-white hover:bg-blue-50 whitespace-nowrap"
                title="斜め撮影や四隅検出ズレを手動で修正"
              >
                📐 傾き調整
              </button>
            )}
          </div>

          {perspectiveTarget === "front" && originalImage && originalCorners && originalSize ? (
            <PerspectiveEditor
              originalImage={originalImage}
              initialCorners={originalCorners}
              originalSize={originalSize}
              onCancel={() => setPerspectiveTarget(null)}
              onConfirm={handlePerspectiveConfirm}
              loading={perspectiveLoading}
              title="表面の傾きを手動で調整"
            />
          ) : (
            <CenteringEditor
              imageSrc={correctedImage || preview!}
              onComplete={(r) => handleFrontCenteringComplete(r as unknown as Record<string, unknown>)}
              onSkip={handleFrontSkipCentering}
              fullartMode={(() => {
                const r = currentBrand?.rarities.find((x) => x.id === selectedRarity);
                return !!r && (!r.has_border || r.border_type === "none");
              })()}
              cardKind={selectedRarity === "l" ? "leader" : "character"}
              initialOuter={outerBox}
            />
          )}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Step 2b: 裏面センタリングエディター */}
      {step === "centering_back" && (backCorrectedImage || backPreview) && (
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setStep("centering_front")}
            className="mb-2 text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
          >
            ← 表面センタリングへ戻る
          </button>
          <div className="mb-3 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                2 / 2
              </span>
              <span className="font-medium text-gray-700">裏面のセンタリング測定</span>
            </div>
            {backOriginalImage && backOriginalCorners && backOriginalSize && (
              <button
                type="button"
                onClick={() => setPerspectiveTarget("back")}
                className="px-2.5 py-1 rounded-full text-[11px] border border-purple-400 text-purple-700 bg-white hover:bg-purple-50 whitespace-nowrap"
              >
                📐 傾き調整
              </button>
            )}
          </div>

          {perspectiveTarget === "back" && backOriginalImage && backOriginalCorners && backOriginalSize ? (
            <PerspectiveEditor
              originalImage={backOriginalImage}
              initialCorners={backOriginalCorners}
              originalSize={backOriginalSize}
              onCancel={() => setPerspectiveTarget(null)}
              onConfirm={handlePerspectiveConfirm}
              loading={perspectiveLoading}
              title="裏面の傾きを手動で調整"
            />
          ) : (
            <CenteringEditor
              imageSrc={backCorrectedImage || backPreview!}
              onComplete={(r) => handleBackCenteringComplete(r as unknown as Record<string, unknown>)}
              onSkip={handleBackSkipCentering}
              fullartMode={false}
              cardKind="character"
              initialOuter={backOuterBox}
            />
          )}
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
            <h2 className="text-2xl font-bold mb-1">📸 表裏チェック</h2>
            <p className="text-sm text-gray-600">
              表面と裏面の画像を1セットでチェックします (裏面は任意)
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {/* 表面 */}
            <div
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${
                dragActive === "front"
                  ? "border-blue-500 bg-blue-50"
                  : preview
                  ? "border-blue-300 bg-blue-50/30"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive("front");
              }}
              onDragLeave={() => setDragActive(null)}
              onDrop={handleDropFront}
              onClick={() => document.getElementById("front-file-input")?.click()}
            >
              <input
                id="front-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <div className="flex items-center justify-center gap-2 mb-2 text-sm font-medium">
                <span>🃏 表面</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${preview ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}>
                  {preview ? "登録済" : "未登録"}
                </span>
                <span className="text-[10px] text-red-500">必須</span>
              </div>
              {preview ? (
                <img src={preview} alt="表面プレビュー" className="max-h-48 mx-auto rounded shadow" />
              ) : (
                <div className="py-6">
                  <div className="text-3xl mb-1">📷</div>
                  <div className="text-xs text-gray-500">クリック / ドロップ</div>
                </div>
              )}
            </div>

            {/* 裏面 */}
            <div
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${
                dragActive === "back"
                  ? "border-purple-500 bg-purple-50"
                  : backPreview
                  ? "border-purple-300 bg-purple-50/30"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive("back");
              }}
              onDragLeave={() => setDragActive(null)}
              onDrop={handleDropBack}
              onClick={() => document.getElementById("back-file-input")?.click()}
            >
              <input
                id="back-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleBackFile(f);
                }}
              />
              <div className="flex items-center justify-center gap-2 mb-2 text-sm font-medium">
                <span>📐 裏面</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${backPreview ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-600"}`}>
                  {backPreview ? "登録済" : "未登録"}
                </span>
                <span className="text-[10px] text-gray-500">任意</span>
              </div>
              {backPreview ? (
                <img src={backPreview} alt="裏面プレビュー" className="max-h-48 mx-auto rounded shadow" />
              ) : (
                <div className="py-6">
                  <div className="text-3xl mb-1">🔄</div>
                  <div className="text-xs text-gray-500">白かけ・角欠け確認用</div>
                </div>
              )}
            </div>
          </div>

          {/* カメラ・変更ボタン */}
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => setCameraTarget("front")}
              className="px-3 py-1.5 rounded-full border border-blue-500 text-blue-600 text-xs font-medium hover:bg-blue-50 transition-colors"
            >
              📷 表面をカメラで撮る
            </button>
            <button
              type="button"
              onClick={() => setCameraTarget("back")}
              className="px-3 py-1.5 rounded-full border border-purple-500 text-purple-600 text-xs font-medium hover:bg-purple-50 transition-colors"
            >
              📷 裏面をカメラで撮る
            </button>
            {(file || backFile) && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 rounded-full text-xs text-red-500 hover:text-red-700"
              >
                すべてクリア
              </button>
            )}
          </div>

          <p className="mt-2 text-[11px] text-gray-500 text-center">
            JPEG / PNG / WebP (推奨: 1000x1400px 以上)。四隅がすべて見えるように撮影してください。
          </p>

          {/* 裏面なしリスク (表面のみ登録時) */}
          {file && !backFile && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              ⚠️ 裏面なしでチェックします。<strong>白かけ・角欠け・エッジ傷</strong>は確認できません。PSA提出前・美品仕入れの判断には裏面の登録を推奨します。
            </div>
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
                準備中...
              </span>
            ) : !selectedBrand ? (
              "ブランドを選択してください"
            ) : !file ? (
              "表面画像をアップロードしてください"
            ) : (
              `${backFile ? "表裏" : "表面のみで"}チェックを開始`
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
            ← 新しいカードをチェック
          </button>
          <GradeResultView
            result={result}
            cardName={cardName}
            brand={selectedBrand}
            cardCode={selectedCardCode ?? undefined}
            hasBackImage={!!backFile}
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
