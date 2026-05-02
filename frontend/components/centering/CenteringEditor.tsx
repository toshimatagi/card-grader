"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

interface Pt { x: number; y: number; }
interface Lines { left: number; right: number; top: number; bottom: number; }
interface GuideLines { outer: Lines; inner: Lines; }

type LandmarkKey = "cost" | "life" | "power" | "name_band";
type LineKey = "left" | "right" | "top" | "bottom";
type LineLayer = "outer" | "inner";

interface CenteringResult {
  lr_ratio: string;
  tb_ratio: string;
  left_border: number;
  right_border: number;
  top_border: number;
  bottom_border: number;
  grades: GradingStandard[];
  outer_corners?: { tl: [number, number]; tr: [number, number]; bl: [number, number]; br: [number, number] };
  inner_corners?: { tl: [number, number]; tr: [number, number]; bl: [number, number]; br: [number, number] };
  landmarks?: Partial<Record<LandmarkKey, [number, number]>>;
  source_width?: number;
  source_height?: number;
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
  fullartMode?: boolean;
  cardKind?: "character" | "leader";
  initialOuter?: Lines | null;  // preprocess の外枠自動検出値
}

const LANDMARK_DEFS: Record<"character" | "leader", Array<{ key: LandmarkKey; label: string; default: Pt }>> = {
  character: [
    { key: "cost", label: "コスト", default: { x: 0.10, y: 0.08 } },
    { key: "power", label: "パワー", default: { x: 0.83, y: 0.92 } },
    { key: "name_band", label: "名前帯", default: { x: 0.50, y: 0.86 } },
  ],
  leader: [
    { key: "life", label: "ライフ", default: { x: 0.83, y: 0.10 } },
    { key: "power", label: "パワー", default: { x: 0.83, y: 0.92 } },
    { key: "name_band", label: "名前帯", default: { x: 0.50, y: 0.86 } },
  ],
};

const DEFAULT_OUTER: Lines = { left: 0.02, right: 0.98, top: 0.02, bottom: 0.98 };
const INNER_MARGIN = 0.04; // 外枠から内側のデフォルト距離

export default function CenteringEditor({
  imageSrc,
  onComplete,
  onSkip,
  fullartMode = false,
  cardKind = "character",
  initialOuter = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);

  // 初期 guides は外枠 (initialOuter or DEFAULT) + 内枠 (外枠から INNER_MARGIN 内側)
  const initialGuides = useMemo<GuideLines>(() => {
    const outer = initialOuter ?? DEFAULT_OUTER;
    return {
      outer,
      inner: {
        left: Math.min(outer.left + INNER_MARGIN, outer.right - 0.02),
        right: Math.max(outer.right - INNER_MARGIN, outer.left + 0.02),
        top: Math.min(outer.top + INNER_MARGIN, outer.bottom - 0.02),
        bottom: Math.max(outer.bottom - INNER_MARGIN, outer.top + 0.02),
      },
    };
  }, [initialOuter]);

  const [guides, setGuides] = useState<GuideLines>(initialGuides);
  // initialOuter が変わったら反映
  useEffect(() => {
    setGuides(initialGuides);
  }, [initialGuides]);

  const [dragging, setDragging] = useState<
    | { kind: "line"; layer: LineLayer; key: LineKey }
    | { kind: "landmark"; key: LandmarkKey }
    | null
  >(null);
  const [activeLayer, setActiveLayer] = useState<"outer" | "inner" | "landmark">("outer");

  const landmarkDefs = LANDMARK_DEFS[cardKind] || LANDMARK_DEFS.character;
  const initialLandmarks: Partial<Record<LandmarkKey, Pt>> = {};
  for (const d of landmarkDefs) initialLandmarks[d.key] = d.default;
  const [landmarks, setLandmarks] = useState<Partial<Record<LandmarkKey, Pt>>>(initialLandmarks);
  const [landmarksTouched, setLandmarksTouched] = useState(false);

  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
    setImageLoaded(true);
  }, []);

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

  const clientToRatio = useCallback(
    (clientX: number, clientY: number): Pt => {
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

  const handleLinePointerDown = useCallback(
    (layer: LineLayer, key: LineKey, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging({ kind: "line", layer, key });
      setActiveLayer(layer);
      containerRef.current?.setPointerCapture(e.pointerId);
    },
    []
  );

  const handleLandmarkPointerDown = useCallback(
    (key: LandmarkKey, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging({ kind: "landmark", key });
      setLandmarksTouched(true);
      containerRef.current?.setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const p = clientToRatio(e.clientX, e.clientY);
      const x = Math.max(0, Math.min(1, p.x));
      const y = Math.max(0, Math.min(1, p.y));
      if (dragging.kind === "line") {
        const { layer, key } = dragging;
        setGuides((prev) => {
          const lines = { ...prev[layer] };
          if (key === "left" || key === "right") {
            lines[key] = x;
            // 左右の入れ替わり防止
            if (lines.left > lines.right - 0.01) {
              if (key === "left") lines.left = lines.right - 0.01;
              else lines.right = lines.left + 0.01;
            }
          } else {
            lines[key] = y;
            if (lines.top > lines.bottom - 0.01) {
              if (key === "top") lines.top = lines.bottom - 0.01;
              else lines.bottom = lines.top + 0.01;
            }
          }
          return { ...prev, [layer]: lines };
        });
      } else {
        setLandmarks((prev) => ({ ...prev, [dragging.key]: { x, y } }));
      }
    },
    [dragging, clientToRatio]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  const calculateCentering = useCallback((): CenteringResult => {
    const { outer, inner } = guides;
    const w = imageSize.w || 1;
    const h = imageSize.h || 1;
    const lrPx = Math.round((inner.left - outer.left) * w);
    const rrPx = Math.round((outer.right - inner.right) * w);
    const trPx = Math.round((inner.top - outer.top) * h);
    const brPx = Math.round((outer.bottom - inner.bottom) * h);

    const lrTotal = lrPx + rrPx || 1;
    const tbTotal = trPx + brPx || 1;
    const lrLarger = Math.round((Math.max(lrPx, rrPx) / lrTotal) * 100);
    const lrSmaller = 100 - lrLarger;
    const tbLarger = Math.round((Math.max(trPx, brPx) / tbTotal) * 100);
    const tbSmaller = 100 - tbLarger;

    const grades = GRADING_STANDARDS.map((std) => ({
      ...std,
      pass: lrLarger <= std.lr_threshold && tbLarger <= std.tb_threshold,
    }));

    const cornersToPx = (l: Lines) => ({
      tl: [Math.round(l.left * w), Math.round(l.top * h)] as [number, number],
      tr: [Math.round(l.right * w), Math.round(l.top * h)] as [number, number],
      bl: [Math.round(l.left * w), Math.round(l.bottom * h)] as [number, number],
      br: [Math.round(l.right * w), Math.round(l.bottom * h)] as [number, number],
    });

    const landmarksPx: Partial<Record<LandmarkKey, [number, number]>> = {};
    if (fullartMode && landmarksTouched) {
      for (const [k, p] of Object.entries(landmarks)) {
        if (p) landmarksPx[k as LandmarkKey] = [Math.round(p.x * w), Math.round(p.y * h)];
      }
    }

    return {
      lr_ratio: `${lrLarger}/${lrSmaller}`,
      tb_ratio: `${tbLarger}/${tbSmaller}`,
      left_border: lrPx,
      right_border: rrPx,
      top_border: trPx,
      bottom_border: brPx,
      grades,
      outer_corners: cornersToPx(outer),
      inner_corners: cornersToPx(inner),
      ...(Object.keys(landmarksPx).length > 0 ? { landmarks: landmarksPx } : {}),
      source_width: w,
      source_height: h,
    };
  }, [guides, imageSize, fullartMode, landmarksTouched, landmarks]);

  const result = imageLoaded ? calculateCentering() : null;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoom((prev) => Math.max(1, Math.min(8, prev + delta)));
  }, []);

  // 線レンダリング (svg)
  const renderLines = (layer: LineLayer, lines: Lines, color: string, isActive: boolean) => {
    const opacity = isActive ? 1 : 0.55;
    return (
      <g key={layer} opacity={opacity}>
        {/* 上 */}
        <line
          x1={0} y1={lines.top * 100}
          x2={100} y2={lines.top * 100}
          stroke={color}
          strokeWidth={isActive ? 0.6 : 0.4}
          vectorEffect="non-scaling-stroke"
        />
        {/* 下 */}
        <line
          x1={0} y1={lines.bottom * 100}
          x2={100} y2={lines.bottom * 100}
          stroke={color}
          strokeWidth={isActive ? 0.6 : 0.4}
          vectorEffect="non-scaling-stroke"
        />
        {/* 左 */}
        <line
          x1={lines.left * 100} y1={0}
          x2={lines.left * 100} y2={100}
          stroke={color}
          strokeWidth={isActive ? 0.6 : 0.4}
          vectorEffect="non-scaling-stroke"
        />
        {/* 右 */}
        <line
          x1={lines.right * 100} y1={0}
          x2={lines.right * 100} y2={100}
          stroke={color}
          strokeWidth={isActive ? 0.6 : 0.4}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    );
  };

  // 線ハンドル (透明な太いタップ領域 + 中央丸ハンドル)
  const renderLineHandle = (
    layer: LineLayer,
    key: LineKey,
    pos: number,
    color: string,
    isActive: boolean
  ) => {
    const isHorizontal = key === "top" || key === "bottom";
    const handleHit = 24; // タップ領域の太さ (px)
    const knobSize = isActive ? 16 : 12;
    return (
      <div
        key={`${layer}-${key}`}
        onPointerDown={(e) => handleLinePointerDown(layer, key, e)}
        style={{
          position: "absolute",
          ...(isHorizontal
            ? {
                left: 0,
                right: 0,
                top: `${pos * 100}%`,
                height: `${handleHit}px`,
                transform: "translateY(-50%)",
                cursor: "ns-resize",
              }
            : {
                top: 0,
                bottom: 0,
                left: `${pos * 100}%`,
                width: `${handleHit}px`,
                transform: "translateX(-50%)",
                cursor: "ew-resize",
              }),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: isActive ? 30 : 20,
          touchAction: "none",
        }}
      >
        <div
          style={{
            width: `${knobSize}px`,
            height: `${knobSize}px`,
            borderRadius: "50%",
            backgroundColor: color,
            border: "2px solid white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
            opacity: isActive ? 1 : 0.7,
            pointerEvents: "none",
          }}
        />
      </div>
    );
  };

  const renderLandmarkHandle = (
    key: LandmarkKey,
    label: string,
    p: Pt,
    isActive: boolean,
    isTouched: boolean
  ) => {
    const color = "#3B82F6";
    const visibleSize = isActive ? 14 : 10;
    return (
      <div
        key={`landmark-${key}`}
        onPointerDown={(e) => handleLandmarkPointerDown(key, e)}
        style={{
          position: "absolute",
          left: `${p.x * 100}%`,
          top: `${p.y * 100}%`,
          transform: "translate(-50%, -50%)",
          width: "32px",
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          zIndex: isActive ? 30 : 18,
          touchAction: "none",
        }}
      >
        <div
          style={{
            width: `${visibleSize}px`,
            height: `${visibleSize}px`,
            borderRadius: "50%",
            backgroundColor: color,
            border: "2px solid white",
            boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
            opacity: isActive ? 1 : isTouched ? 0.8 : 0.4,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "100%",
            marginTop: "2px",
            fontSize: "9px",
            color,
            backgroundColor: "rgba(255,255,255,0.85)",
            padding: "1px 4px",
            borderRadius: "2px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            opacity: isActive ? 1 : 0.6,
          }}
        >
          {label}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-1">センタリング測定</h2>
        <p className="text-sm text-gray-600">
          {initialOuter
            ? "外枠は自動検出済み。内枠 (印刷枠) の4本のラインを微調整してください。"
            : "外枠 (カード端) と内枠 (印刷枠) の各4本のラインを合わせてください。"}
        </p>
      </div>

      <div className="flex justify-center gap-2 flex-wrap">
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
        {fullartMode && (
          <button
            onClick={() => setActiveLayer("landmark")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeLayer === "landmark"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
            title="フルアート系カード向け: 主要パーツの位置を指定して精度を上げる"
          >
            🔵 デザイン位置 (任意)
          </button>
        )}
        <button
          onClick={() => {
            setGuides(initialGuides);
            setLandmarks(initialLandmarks);
            setLandmarksTouched(false);
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700"
          title="位置をリセット"
        >
          ↺ リセット
        </button>
      </div>

      {fullartMode && activeLayer === "landmark" && (
        <p className="text-center text-xs text-gray-600">
          🔵 をドラッグしてカード上の位置に合わせてください (動かさない場合はそのランドマークは未測定)
        </p>
      )}

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-lg"
        >
          −
        </button>
        <span className="text-sm font-medium min-w-[50px] text-center">{zoom.toFixed(1)}x</span>
        <button
          onClick={() => setZoom((z) => Math.min(8, z + 0.5))}
          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-lg"
        >
          +
        </button>
      </div>

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
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                {renderLines("outer", guides.outer, "#EAB308", activeLayer === "outer")}
                {renderLines("inner", guides.inner, "#22C55E", activeLayer === "inner")}
              </svg>

              {/* 線ハンドル (active layer のみ表示してUI整理) */}
              {(["outer", "inner"] as const).map((layer) => {
                const isActive = activeLayer === layer;
                const color = layer === "outer" ? "#EAB308" : "#22C55E";
                return (
                  <div key={layer} style={{ display: isActive ? "block" : "none" }}>
                    {(["top", "bottom"] as const).map((key) =>
                      renderLineHandle(layer, key, guides[layer][key], color, true)
                    )}
                    {(["left", "right"] as const).map((key) =>
                      renderLineHandle(layer, key, guides[layer][key], color, true)
                    )}
                  </div>
                );
              })}

              {fullartMode &&
                landmarkDefs.map((d) => {
                  const p = landmarks[d.key] ?? d.default;
                  return renderLandmarkHandle(
                    d.key,
                    d.label,
                    p,
                    activeLayer === "landmark",
                    landmarksTouched
                  );
                })}
            </>
          )}
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500">左右 (L/R)</div>
              <div
                className={`text-2xl font-bold ${
                  parseInt(result.lr_ratio) <= 55
                    ? "text-green-600"
                    : parseInt(result.lr_ratio) <= 60
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {result.lr_ratio}
              </div>
              <div className="text-xs text-gray-400">
                L:{result.left_border}px / R:{result.right_border}px
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">上下 (T/B)</div>
              <div
                className={`text-2xl font-bold ${
                  parseInt(result.tb_ratio) <= 55
                    ? "text-green-600"
                    : parseInt(result.tb_ratio) <= 60
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {result.tb_ratio}
              </div>
              <div className="text-xs text-gray-400">
                T:{result.top_border}px / B:{result.bottom_border}px
              </div>
            </div>
          </div>

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
