"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface GuideLines {
  outerLeft: number;
  outerRight: number;
  outerTop: number;
  outerBottom: number;
  innerLeft: number;
  innerRight: number;
  innerTop: number;
  innerBottom: number;
}

interface CenteringResult {
  lr_ratio: string;
  tb_ratio: string;
  left_border: number;
  right_border: number;
  top_border: number;
  bottom_border: number;
  grades: GradingStandard[];
}

interface GradingStandard {
  name: string;
  lr_threshold: number;
  tb_threshold: number;
  max_grade: string;
  pass: boolean;
}

const GRADING_STANDARDS: Omit<GradingStandard, "pass">[] = [
  { name: "PSA 10", lr_threshold: 55, tb_threshold: 55, max_grade: "10" },
  { name: "PSA 9", lr_threshold: 60, tb_threshold: 60, max_grade: "9" },
  { name: "PSA 8", lr_threshold: 65, tb_threshold: 65, max_grade: "8" },
  { name: "PSA 7", lr_threshold: 70, tb_threshold: 70, max_grade: "7" },
  { name: "BGS 10", lr_threshold: 50, tb_threshold: 50, max_grade: "10" },
  { name: "BGS 9.5", lr_threshold: 55, tb_threshold: 55, max_grade: "9.5" },
  { name: "BGS 9", lr_threshold: 60, tb_threshold: 60, max_grade: "9" },
  { name: "CGC 10", lr_threshold: 55, tb_threshold: 55, max_grade: "10" },
  { name: "CGC 9", lr_threshold: 60, tb_threshold: 60, max_grade: "9" },
];

interface Props {
  imageSrc: string;
  onComplete: (result: CenteringResult) => void;
  onSkip: () => void;
}

export default function CenteringEditor({ imageSrc, onComplete, onSkip }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // ガイドラインの位置（画像のピクセル座標、0-1の比率で管理）
  const [guides, setGuides] = useState<GuideLines>({
    outerLeft: 0.02,
    outerRight: 0.98,
    outerTop: 0.02,
    outerBottom: 0.98,
    innerLeft: 0.06,
    innerRight: 0.94,
    innerTop: 0.06,
    innerBottom: 0.94,
  });

  const [dragging, setDragging] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<"outer" | "inner">("outer");
  const [showResult, setShowResult] = useState(false);

  // 画像ロード時にサイズ取得
  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
    setImageLoaded(true);
  }, []);

  // 表示サイズの計算
  useEffect(() => {
    if (!imageLoaded || !containerRef.current) return;
    const container = containerRef.current;
    const maxW = container.clientWidth;
    const maxH = 500;
    const scale = Math.min(maxW / imageSize.w, maxH / imageSize.h, 1);
    setDisplaySize({
      w: Math.round(imageSize.w * scale),
      h: Math.round(imageSize.h * scale),
    });
  }, [imageLoaded, imageSize]);

  // 画像内ラッパーのref（ガイドラインの親要素）
  const wrapperRef = useRef<HTMLDivElement>(null);

  // マウス座標 → 画像上の比率(0-1)に変換
  const clientToRatio = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return { x: 0.5, y: 0.5 };
      const rect = wrapper.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      };
    },
    []
  );

  // ガイドラインのドラッグ
  const handlePointerDown = useCallback(
    (lineId: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(lineId);
      // containerにポインターキャプチャを設定（ライン外に出てもドラッグ継続）
      containerRef.current?.setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;

      const { x, y } = clientToRatio(e.clientX, e.clientY);
      const isVertical = dragging.includes("Left") || dragging.includes("Right");
      const value = isVertical ? x : y;
      const clamped = Math.max(0.01, Math.min(0.99, value));

      setGuides((prev) => ({ ...prev, [dragging]: clamped }));
    },
    [dragging, clientToRatio]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  // センタリング計算
  const calculateCentering = useCallback((): CenteringResult => {
    const leftBorder = guides.innerLeft - guides.outerLeft;
    const rightBorder = guides.outerRight - guides.innerRight;
    const topBorder = guides.innerTop - guides.outerTop;
    const bottomBorder = guides.outerBottom - guides.innerBottom;

    const lrTotal = leftBorder + rightBorder || 0.001;
    const tbTotal = topBorder + bottomBorder || 0.001;

    const lrLarger = Math.round((Math.max(leftBorder, rightBorder) / lrTotal) * 100);
    const lrSmaller = 100 - lrLarger;
    const tbLarger = Math.round((Math.max(topBorder, bottomBorder) / tbTotal) * 100);
    const tbSmaller = 100 - tbLarger;

    const lrPx = Math.round(leftBorder * imageSize.w);
    const rrPx = Math.round(rightBorder * imageSize.w);
    const trPx = Math.round(topBorder * imageSize.h);
    const brPx = Math.round(bottomBorder * imageSize.h);

    const grades = GRADING_STANDARDS.map((std) => ({
      ...std,
      pass: lrLarger <= std.lr_threshold && tbLarger <= std.tb_threshold,
    }));

    return {
      lr_ratio: `${lrLarger}/${lrSmaller}`,
      tb_ratio: `${tbLarger}/${tbSmaller}`,
      left_border: lrPx,
      right_border: rrPx,
      top_border: trPx,
      bottom_border: brPx,
      grades,
    };
  }, [guides, imageSize]);

  const result = imageLoaded ? calculateCentering() : null;

  // ズーム操作
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.2 : 0.2;
      setZoom((prev) => Math.max(1, Math.min(8, prev + delta)));
    },
    []
  );

  const renderGuideLine = (
    id: string,
    position: number,
    orientation: "vertical" | "horizontal",
    color: string,
    label: string,
    isActive: boolean
  ) => {
    const style: React.CSSProperties =
      orientation === "vertical"
        ? {
            left: `${position * 100}%`,
            top: 0,
            bottom: 0,
            width: isActive ? "4px" : "2px",
            cursor: "ew-resize",
            backgroundColor: color,
            position: "absolute",
            opacity: isActive ? 1 : 0.5,
            zIndex: isActive ? 20 : 10,
            touchAction: "none",
          }
        : {
            top: `${position * 100}%`,
            left: 0,
            right: 0,
            height: isActive ? "4px" : "2px",
            cursor: "ns-resize",
            backgroundColor: color,
            position: "absolute",
            opacity: isActive ? 1 : 0.5,
            zIndex: isActive ? 20 : 10,
            touchAction: "none",
          };

    return (
      <div
        key={id}
        style={style}
        onPointerDown={(e) => handlePointerDown(id, e)}
        title={label}
      >
        {/* ドラッグハンドル（広めのタッチ領域） */}
        <div
          style={{
            position: "absolute",
            ...(orientation === "vertical"
              ? { left: "-12px", right: "-12px", top: 0, bottom: 0 }
              : { top: "-12px", bottom: "-12px", left: 0, right: 0 }),
            cursor: orientation === "vertical" ? "ew-resize" : "ns-resize",
          }}
        />
        {/* ラベル */}
        {isActive && (
          <div
            style={{
              position: "absolute",
              ...(orientation === "vertical"
                ? { top: "4px", left: "6px" }
                : { left: "4px", top: "6px" }),
              fontSize: "10px",
              color: color,
              fontWeight: "bold",
              backgroundColor: "rgba(255,255,255,0.85)",
              padding: "1px 4px",
              borderRadius: "2px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {label}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-1">センタリング測定</h2>
        <p className="text-sm text-gray-600">
          ガイドラインをドラッグしてカード枠に合わせてください
        </p>
      </div>

      {/* レイヤー切替 */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setActiveLayer("outer")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeLayer === "outer"
              ? "bg-yellow-500 text-white"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          🟡 外枠（カード端）
        </button>
        <button
          onClick={() => setActiveLayer("inner")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeLayer === "inner"
              ? "bg-green-500 text-white"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          🟢 内枠（印刷枠）
        </button>
      </div>

      {/* ズームコントロール */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-lg"
        >
          −
        </button>
        <span className="text-sm font-medium min-w-[50px] text-center">
          {zoom.toFixed(1)}x
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(8, z + 0.5))}
          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-lg"
        >
          +
        </button>
        <button
          onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
          className="text-xs text-gray-500 hover:text-gray-700 ml-2"
        >
          リセット
        </button>
      </div>

      {/* 画像 + ガイドライン */}
      <div
        ref={containerRef}
        className="relative overflow-hidden bg-gray-100 rounded-xl border-2 border-gray-300"
        style={{ maxHeight: "520px" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <div
          ref={wrapperRef}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
            position: "relative",
            width: displaySize.w || "100%",
            height: displaySize.h || "auto",
            margin: "0 auto",
          }}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt="カード画像"
            onLoad={handleImageLoad}
            style={{
              width: displaySize.w || "100%",
              height: displaySize.h || "auto",
              display: "block",
            }}
            draggable={false}
          />

          {imageLoaded && (
            <>
              {/* 外枠ガイドライン（黄色） */}
              {renderGuideLine("outerLeft", guides.outerLeft, "vertical", "#EAB308", "外枠 左", activeLayer === "outer")}
              {renderGuideLine("outerRight", guides.outerRight, "vertical", "#EAB308", "外枠 右", activeLayer === "outer")}
              {renderGuideLine("outerTop", guides.outerTop, "horizontal", "#EAB308", "外枠 上", activeLayer === "outer")}
              {renderGuideLine("outerBottom", guides.outerBottom, "horizontal", "#EAB308", "外枠 下", activeLayer === "outer")}

              {/* 内枠ガイドライン（緑） */}
              {renderGuideLine("innerLeft", guides.innerLeft, "vertical", "#22C55E", "内枠 左", activeLayer === "inner")}
              {renderGuideLine("innerRight", guides.innerRight, "vertical", "#22C55E", "内枠 右", activeLayer === "inner")}
              {renderGuideLine("innerTop", guides.innerTop, "horizontal", "#22C55E", "内枠 上", activeLayer === "inner")}
              {renderGuideLine("innerBottom", guides.innerBottom, "horizontal", "#22C55E", "内枠 下", activeLayer === "inner")}

              {/* ボーダー領域の半透明オーバーレイ */}
              <div
                style={{
                  position: "absolute",
                  left: `${guides.outerLeft * 100}%`,
                  top: `${guides.outerTop * 100}%`,
                  right: `${(1 - guides.outerRight) * 100}%`,
                  bottom: `${(1 - guides.outerBottom) * 100}%`,
                  border: "2px dashed rgba(234, 179, 8, 0.6)",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${guides.innerLeft * 100}%`,
                  top: `${guides.innerTop * 100}%`,
                  right: `${(1 - guides.innerRight) * 100}%`,
                  bottom: `${(1 - guides.innerBottom) * 100}%`,
                  border: "2px dashed rgba(34, 197, 94, 0.6)",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* リアルタイム結果表示 */}
      {result && (
        <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500">左右 (L/R)</div>
              <div className={`text-2xl font-bold ${
                parseInt(result.lr_ratio) <= 55 ? "text-green-600" :
                parseInt(result.lr_ratio) <= 60 ? "text-yellow-600" : "text-red-600"
              }`}>
                {result.lr_ratio}
              </div>
              <div className="text-xs text-gray-400">
                L:{result.left_border}px / R:{result.right_border}px
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">上下 (T/B)</div>
              <div className={`text-2xl font-bold ${
                parseInt(result.tb_ratio) <= 55 ? "text-green-600" :
                parseInt(result.tb_ratio) <= 60 ? "text-yellow-600" : "text-red-600"
              }`}>
                {result.tb_ratio}
              </div>
              <div className="text-xs text-gray-400">
                T:{result.top_border}px / B:{result.bottom_border}px
              </div>
            </div>
          </div>

          {/* 鑑定機関別グレード */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">鑑定機関別の最高グレード</div>
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
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
        >
          自動検出で鑑定
        </button>
        <button
          onClick={() => result && onComplete(result)}
          disabled={!result}
          className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium disabled:bg-gray-400"
        >
          この設定で鑑定開始
        </button>
      </div>
    </div>
  );
}
