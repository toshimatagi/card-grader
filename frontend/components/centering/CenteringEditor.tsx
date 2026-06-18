"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Lines { left: number; right: number; top: number; bottom: number; }

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
  { name: "PSA 9",  lr_threshold: 60, tb_threshold: 60, max_grade: "9" },
  { name: "PSA 8",  lr_threshold: 65, tb_threshold: 65, max_grade: "8" },
  { name: "PSA 7",  lr_threshold: 70, tb_threshold: 70, max_grade: "7" },
  { name: "BGS 10", lr_threshold: 50, tb_threshold: 50, max_grade: "10" },
  { name: "BGS 9.5",lr_threshold: 55, tb_threshold: 55, max_grade: "9.5" },
  { name: "BGS 9",  lr_threshold: 60, tb_threshold: 60, max_grade: "9" },
  { name: "CGC 10", lr_threshold: 55, tb_threshold: 55, max_grade: "10" },
  { name: "CGC 9",  lr_threshold: 60, tb_threshold: 60, max_grade: "9" },
];

// Default inner line positions (ratio 0–1): typical bordered TCG card ~5% border
const INNER_DEFAULT_BORDERED: Lines = { left: 0.05, right: 0.95, top: 0.04, bottom: 0.94 };
const INNER_DEFAULT_FULLART:  Lines = { left: 0.02, right: 0.98, top: 0.02, bottom: 0.98 };
const OUTER_DEFAULT: Lines = { left: 0.0,  right: 1.0,  top: 0.0,  bottom: 1.0 };

type LineKey  = "left" | "right" | "top" | "bottom";
type LayerKey = "inner" | "outer";

interface Props {
  imageSrc: string;
  onComplete: (result: CenteringResult) => void;
  onSkip: () => void;
  // Legacy props kept for call-site compat — behaviour simplified
  fullartMode?: boolean;
  cardKind?: "character" | "leader";
  initialOuter?: Lines | null;
}

export default function CenteringEditor({
  imageSrc,
  onComplete,
  onSkip,
  fullartMode = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef   = useRef<HTMLDivElement>(null);
  const imageRef     = useRef<HTMLImageElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize]     = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);

  const innerDefault = fullartMode ? INNER_DEFAULT_FULLART : INNER_DEFAULT_BORDERED;
  const [inner, setInner] = useState<Lines>(innerDefault);
  const [outer, setOuter] = useState<Lines>(OUTER_DEFAULT);
  const [showOuter, setShowOuter] = useState(false);
  const [dragging, setDragging] = useState<{ layer: LayerKey; key: LineKey } | null>(null);

  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
    setImageLoaded(true);
  }, []);

  useEffect(() => {
    if (!imageLoaded || !containerRef.current) return;
    const maxW = containerRef.current.clientWidth;
    const maxH = 520;
    const scale = Math.min(maxW / imageSize.w, maxH / imageSize.h, 1);
    setDisplaySize({ w: Math.round(imageSize.w * scale), h: Math.round(imageSize.h * scale) });
  }, [imageLoaded, imageSize]);

  const clientToRatio = useCallback((clientX: number, clientY: number) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return { x: 0.5, y: 0.5 };
    const rect = wrapper.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left)  / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const handlePointerDown = useCallback((layer: LayerKey, key: LineKey, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging({ layer, key });
    containerRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const p = clientToRatio(e.clientX, e.clientY);
    const { layer, key } = dragging;
    const setFn = layer === "inner" ? setInner : setOuter;
    setFn((prev) => {
      const next = { ...prev };
      if (key === "left" || key === "right") {
        next[key] = p.x;
        if (next.left > next.right - 0.01) {
          if (key === "left") next.left  = next.right - 0.01;
          else                next.right = next.left  + 0.01;
        }
      } else {
        next[key] = p.y;
        if (next.top > next.bottom - 0.01) {
          if (key === "top") next.top    = next.bottom - 0.01;
          else               next.bottom = next.top    + 0.01;
        }
      }
      return next;
    });
  }, [dragging, clientToRatio]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(1, Math.min(8, z + (e.deltaY > 0 ? -0.2 : 0.2))));
  }, []);

  const calculateResult = useCallback((): CenteringResult | null => {
    if (!imageLoaded) return null;
    const { w, h } = imageSize;
    const eff = showOuter ? outer : OUTER_DEFAULT;

    const leftPx   = Math.round((inner.left   - eff.left)   * w);
    const rightPx  = Math.round((eff.right    - inner.right) * w);
    const topPx    = Math.round((inner.top    - eff.top)    * h);
    const bottomPx = Math.round((eff.bottom   - inner.bottom)* h);

    const lrTotal = leftPx   + rightPx   || 1;
    const tbTotal = topPx    + bottomPx  || 1;
    const lrLarger = Math.round((Math.max(leftPx,  rightPx)  / lrTotal) * 100);
    const tbLarger = Math.round((Math.max(topPx,   bottomPx) / tbTotal) * 100);

    const grades = GRADING_STANDARDS.map((std) => ({
      ...std,
      pass: lrLarger <= std.lr_threshold && tbLarger <= std.tb_threshold,
    }));

    const toPx = (l: Lines) => ({
      tl: [Math.round(l.left  * w), Math.round(l.top    * h)] as [number, number],
      tr: [Math.round(l.right * w), Math.round(l.top    * h)] as [number, number],
      bl: [Math.round(l.left  * w), Math.round(l.bottom * h)] as [number, number],
      br: [Math.round(l.right * w), Math.round(l.bottom * h)] as [number, number],
    });

    return {
      lr_ratio: `${lrLarger}/${100 - lrLarger}`,
      tb_ratio: `${tbLarger}/${100 - tbLarger}`,
      left_border:   leftPx,
      right_border:  rightPx,
      top_border:    topPx,
      bottom_border: bottomPx,
      grades,
      outer_corners: toPx(eff),
      inner_corners: toPx(inner),
      source_width:  w,
      source_height: h,
    };
  }, [inner, outer, showOuter, imageSize, imageLoaded]);

  const result = calculateResult();

  // SVG line element
  const svgLine = (pos: number, isH: boolean, color: string) => (
    <line
      key={`${isH ? "h" : "v"}-${pos}`}
      {...(isH
        ? { x1: 0, y1: pos * 100, x2: 100, y2: pos * 100 }
        : { x1: pos * 100, y1: 0, x2: pos * 100, y2: 100 })}
      stroke={color}
      strokeWidth="0.7"
      vectorEffect="non-scaling-stroke"
    />
  );

  // Drag handle overlay
  const dragHandle = (layer: LayerKey, key: LineKey, pos: number, color: string) => {
    const isH = key === "top" || key === "bottom";
    return (
      <div
        key={`${layer}-${key}`}
        onPointerDown={(e) => handlePointerDown(layer, key, e)}
        style={{
          position: "absolute",
          ...(isH
            ? { left: 0, right: 0,   top:  `${pos * 100}%`, height: "28px", transform: "translateY(-50%)", cursor: "ns-resize" }
            : { top:  0, bottom: 0, left: `${pos * 100}%`, width:  "28px", transform: "translateX(-50%)", cursor: "ew-resize" }),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 30,
          touchAction: "none",
        }}
      >
        <div style={{
          width: "18px", height: "18px",
          borderRadius: "50%",
          backgroundColor: color,
          border: "2.5px solid white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
          pointerEvents: "none",
        }} />
      </div>
    );
  };

  const ratioColor = (r: number) =>
    r <= 55 ? "text-green-600" : r <= 60 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-1">センタリング測定</h2>
        <p className="text-sm text-gray-600">
          緑の線を<strong>白フチと絵柄の境界</strong>にドラッグして合わせてください
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          onClick={() => setShowOuter((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            showOuter
              ? "bg-yellow-400 text-white border-yellow-400"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
          title="背景が写り込んでいる場合は外枠も手動設定"
        >
          🟡 外枠も設定 {showOuter ? "ON" : "OFF"}
        </button>

        <button
          onClick={() => { setInner(innerDefault); setOuter(OUTER_DEFAULT); }}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
        >
          ↺ リセット
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
            className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-sm font-bold"
          >−</button>
          <span className="text-xs font-medium min-w-[36px] text-center">{zoom.toFixed(1)}x</span>
          <button
            onClick={() => setZoom((z) => Math.min(8, z + 0.5))}
            className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-sm font-bold"
          >+</button>
        </div>
      </div>

      {showOuter && (
        <p className="text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-1.5 px-3">
          🟡 黄色の線をカードの物理的な外枠に、緑の線を白フチ内側の境界に合わせてください
        </p>
      )}

      {/* Image editor */}
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
            style={{ width: displaySize.w || "100%", height: displaySize.h || "auto", display: "block" }}
            draggable={false}
          />

          {imageLoaded && (
            <>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }}
              >
                {/* Inner lines: green */}
                {svgLine(inner.top,    true,  "#22C55E")}
                {svgLine(inner.bottom, true,  "#22C55E")}
                {svgLine(inner.left,   false, "#22C55E")}
                {svgLine(inner.right,  false, "#22C55E")}
                {/* Outer lines: yellow (conditional) */}
                {showOuter && svgLine(outer.top,    true,  "#EAB308")}
                {showOuter && svgLine(outer.bottom, true,  "#EAB308")}
                {showOuter && svgLine(outer.left,   false, "#EAB308")}
                {showOuter && svgLine(outer.right,  false, "#EAB308")}
              </svg>

              {/* Inner handles */}
              {dragHandle("inner", "top",    inner.top,    "#22C55E")}
              {dragHandle("inner", "bottom", inner.bottom, "#22C55E")}
              {dragHandle("inner", "left",   inner.left,   "#22C55E")}
              {dragHandle("inner", "right",  inner.right,  "#22C55E")}

              {/* Outer handles (conditional) */}
              {showOuter && dragHandle("outer", "top",    outer.top,    "#EAB308")}
              {showOuter && dragHandle("outer", "bottom", outer.bottom, "#EAB308")}
              {showOuter && dragHandle("outer", "left",   outer.left,   "#EAB308")}
              {showOuter && dragHandle("outer", "right",  outer.right,  "#EAB308")}
            </>
          )}
        </div>
      </div>

      {/* Live result */}
      {result && (
        <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">左右 (L/R)</div>
              <div className={`text-3xl font-bold ${ratioColor(parseInt(result.lr_ratio))}`}>
                {result.lr_ratio}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                左 {result.left_border}px / 右 {result.right_border}px
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">上下 (T/B)</div>
              <div className={`text-3xl font-bold ${ratioColor(parseInt(result.tb_ratio))}`}>
                {result.tb_ratio}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                上 {result.top_border}px / 下 {result.bottom_border}px
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">鑑定機関別の最高グレード</div>
            <div className="grid grid-cols-3 gap-1.5">
              {result.grades.map((g) => (
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
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
        >
          スキップ (AIチェック)
        </button>
        <button
          onClick={() => result && onComplete(result)}
          disabled={!result}
          className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium disabled:bg-gray-400"
        >
          この測定で鑑定開始
        </button>
      </div>
    </div>
  );
}
