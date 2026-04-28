"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Pt { x: number; y: number; }
interface Quad { tl: Pt; tr: Pt; bl: Pt; br: Pt; }
interface QuadGuides { outer: Quad; inner: Quad; }

type LandmarkKey = "cost" | "life" | "power" | "name_band";

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
}

// レイアウト種別ごとのランドマーク定義 (ラベル + 初期位置)
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

const INITIAL: QuadGuides = {
  outer: {
    tl: { x: 0.03, y: 0.03 },
    tr: { x: 0.97, y: 0.03 },
    bl: { x: 0.03, y: 0.97 },
    br: { x: 0.97, y: 0.97 },
  },
  inner: {
    tl: { x: 0.07, y: 0.07 },
    tr: { x: 0.93, y: 0.07 },
    bl: { x: 0.07, y: 0.93 },
    br: { x: 0.93, y: 0.93 },
  },
};

const CORNER_KEYS: (keyof Quad)[] = ["tl", "tr", "bl", "br"];

const midpoint = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distPx = (a: Pt, b: Pt, w: number, h: number): number =>
  Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);

export default function CenteringEditor({
  imageSrc,
  onComplete,
  onSkip,
  fullartMode = false,
  cardKind = "character",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);

  const [guides, setGuides] = useState<QuadGuides>(INITIAL);
  const [dragging, setDragging] = useState<
    | { kind: "quad"; layer: "outer" | "inner"; corner: keyof Quad }
    | { kind: "landmark"; key: LandmarkKey }
    | null
  >(null);
  const [activeLayer, setActiveLayer] = useState<"outer" | "inner" | "landmark">("outer");

  // ランドマーク (フルアート系のみ): デフォルトはテンプレ位置、ユーザー操作で更新
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

  const handleQuadPointerDown = useCallback(
    (layer: "outer" | "inner", corner: keyof Quad, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging({ kind: "quad", layer, corner });
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
      if (dragging.kind === "quad") {
        setGuides((prev) => ({
          ...prev,
          [dragging.layer]: { ...prev[dragging.layer], [dragging.corner]: { x, y } },
        }));
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
    // 各辺の中点 (左右辺は tl-bl と tr-br、上下辺は tl-tr と bl-br)
    const oL = midpoint(outer.tl, outer.bl);
    const oR = midpoint(outer.tr, outer.br);
    const oT = midpoint(outer.tl, outer.tr);
    const oB = midpoint(outer.bl, outer.br);
    const iL = midpoint(inner.tl, inner.bl);
    const iR = midpoint(inner.tr, inner.br);
    const iT = midpoint(inner.tl, inner.tr);
    const iB = midpoint(inner.bl, inner.br);

    const w = imageSize.w || 1;
    const h = imageSize.h || 1;
    const lrPx = Math.round(distPx(oL, iL, w, h));
    const rrPx = Math.round(distPx(oR, iR, w, h));
    const trPx = Math.round(distPx(oT, iT, w, h));
    const brPx = Math.round(distPx(oB, iB, w, h));

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

    const cornersToPx = (q: Quad) => ({
      tl: [Math.round(q.tl.x * w), Math.round(q.tl.y * h)] as [number, number],
      tr: [Math.round(q.tr.x * w), Math.round(q.tr.y * h)] as [number, number],
      bl: [Math.round(q.bl.x * w), Math.round(q.bl.y * h)] as [number, number],
      br: [Math.round(q.br.x * w), Math.round(q.br.y * h)] as [number, number],
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

  const renderQuad = (
    layer: "outer" | "inner",
    quad: Quad,
    color: string,
    isActive: boolean
  ) => {
    const points = [quad.tl, quad.tr, quad.br, quad.bl]
      .map((p) => `${p.x * 100},${p.y * 100}`)
      .join(" ");
    return (
      <g key={layer} opacity={isActive ? 1 : 0.7}>
        <polygon
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={isActive ? 4 : 3}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "none" }}
        />
      </g>
    );
  };

  const renderCornerHandle = (
    layer: "outer" | "inner",
    corner: keyof Quad,
    p: Pt,
    color: string,
    isActive: boolean
  ) => {
    const visibleSize = isActive ? 10 : 7;   // 視認用の小さい丸
    const hitSize = isActive ? 28 : 22;      // 透明な広いタップ領域
    return (
      <div
        key={`${layer}-${corner}`}
        onPointerDown={(e) => handleQuadPointerDown(layer, corner, e)}
        style={{
          position: "absolute",
          left: `${p.x * 100}%`,
          top: `${p.y * 100}%`,
          transform: "translate(-50%, -50%)",
          width: `${hitSize}px`,
          height: `${hitSize}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          zIndex: isActive ? 30 : 20,
          touchAction: "none",
        }}
      >
        <div
          style={{
            width: `${visibleSize}px`,
            height: `${visibleSize}px`,
            borderRadius: "50%",
            backgroundColor: color,
            border: "1.5px solid white",
            boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
            opacity: isActive ? 1 : 0.6,
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
    const color = "#3B82F6"; // blue-500
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
            color: color,
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
          4隅の点をドラッグしてカード枠に合わせてください (斜め撮影にも対応)
        </p>
      </div>

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
            setGuides(INITIAL);
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
                {renderQuad("outer", guides.outer, "#EAB308", activeLayer === "outer")}
                {renderQuad("inner", guides.inner, "#22C55E", activeLayer === "inner")}
              </svg>

              {/* 4隅のドラッグハンドル */}
              {(["outer", "inner"] as const).map((layer) =>
                CORNER_KEYS.map((corner) =>
                  renderCornerHandle(
                    layer,
                    corner,
                    guides[layer][corner],
                    layer === "outer" ? "#EAB308" : "#22C55E",
                    activeLayer === layer
                  )
                )
              )}

              {/* ランドマーク (フルアート系のみ表示) */}
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
