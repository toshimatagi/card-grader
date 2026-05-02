"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CornerPoints } from "../../lib/api";

interface Props {
  /** Base64 (no data: prefix) of the original image (resized to max 1200px). */
  originalImage: string;
  /** Auto-detected (or current) corners in original image pixel coords. */
  initialCorners: CornerPoints;
  /** Original image size (resized) in pixels. */
  originalSize: { w: number; h: number };
  onCancel: () => void;
  onConfirm: (corners: CornerPoints) => void;
  loading?: boolean;
  title?: string;
}

type CornerKey = "tl" | "tr" | "br" | "bl";

const CORNER_LABELS: Record<CornerKey, string> = {
  tl: "左上",
  tr: "右上",
  br: "右下",
  bl: "左下",
};

export default function PerspectiveEditor({
  originalImage,
  initialCorners,
  originalSize,
  onCancel,
  onConfirm,
  loading,
  title,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<CornerPoints>(initialCorners);
  const [activeCorner, setActiveCorner] = useState<CornerKey | null>(null);
  const [imgRect, setImgRect] = useState<DOMRect | null>(null);

  // resize 時に img の表示矩形を更新
  const refreshImgRect = useCallback(() => {
    if (imgRef.current) setImgRect(imgRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    refreshImgRect();
    window.addEventListener("resize", refreshImgRect);
    window.addEventListener("scroll", refreshImgRect, true);
    return () => {
      window.removeEventListener("resize", refreshImgRect);
      window.removeEventListener("scroll", refreshImgRect, true);
    };
  }, [refreshImgRect]);

  // image px → display px
  const toDisplay = useCallback(
    (px: [number, number]): { x: number; y: number } => {
      if (!imgRect) return { x: 0, y: 0 };
      const sx = imgRect.width / originalSize.w;
      const sy = imgRect.height / originalSize.h;
      return { x: px[0] * sx, y: px[1] * sy };
    },
    [imgRect, originalSize]
  );

  // display (client) px → image px
  const fromClient = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      if (!imgRect) return [0, 0];
      const dx = Math.max(0, Math.min(imgRect.width, clientX - imgRect.left));
      const dy = Math.max(0, Math.min(imgRect.height, clientY - imgRect.top));
      const sx = originalSize.w / imgRect.width;
      const sy = originalSize.h / imgRect.height;
      return [dx * sx, dy * sy];
    },
    [imgRect, originalSize]
  );

  // pointer events (mouse + touch 統一)
  const handlePointerDown = (key: CornerKey) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveCorner(key);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeCorner) return;
    const next: [number, number] = fromClient(e.clientX, e.clientY);
    setCorners((c) => ({ ...c, [activeCorner]: next }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!activeCorner) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setActiveCorner(null);
  };

  // 拡大鏡: ドラッグ中の corner 位置を中心に背景画像を拡大表示
  const renderMagnifier = () => {
    if (!activeCorner || !imgRect) return null;
    const ZOOM = 2.5;
    const SIZE = 110; // 拡大鏡の表示サイズ (CSS px)
    const cornerImgPx = corners[activeCorner];
    const cornerDisp = toDisplay(cornerImgPx);

    // 拡大鏡の表示位置: 指/マウス上方 100px、左右は端に近づけば反転
    const offsetY = -120;
    const offsetX = cornerDisp.x > imgRect.width / 2 ? -120 : 80;
    const left = cornerDisp.x + offsetX;
    const top = cornerDisp.y + offsetY;

    // 背景画像を拡大表示 (background-position で対象点が中心に来るように)
    const bgSize = `${imgRect.width * ZOOM}px ${imgRect.height * ZOOM}px`;
    const bgX = -(cornerDisp.x * ZOOM - SIZE / 2);
    const bgY = -(cornerDisp.y * ZOOM - SIZE / 2);

    return (
      <div
        className="absolute pointer-events-none rounded-full border-2 border-blue-500 shadow-lg overflow-hidden bg-gray-900"
        style={{
          left,
          top,
          width: SIZE,
          height: SIZE,
          backgroundImage: `url(data:image/jpeg;base64,${originalImage})`,
          backgroundSize: bgSize,
          backgroundPosition: `${bgX}px ${bgY}px`,
          backgroundRepeat: "no-repeat",
          zIndex: 30,
        }}
      >
        {/* 拡大鏡の中心十字 */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
        >
          <line x1="50" y1="35" x2="50" y2="65" stroke="rgb(239,68,68)" strokeWidth="0.8" />
          <line x1="35" y1="50" x2="65" y2="50" stroke="rgb(239,68,68)" strokeWidth="0.8" />
          <circle cx="50" cy="50" r="2" fill="none" stroke="rgb(239,68,68)" strokeWidth="0.6" />
        </svg>
      </div>
    );
  };

  // 4辺をなぞる SVG path
  const renderQuadPath = () => {
    if (!imgRect) return null;
    const order: CornerKey[] = ["tl", "tr", "br", "bl"];
    const pts = order.map((k) => toDisplay(corners[k]));
    const d =
      `M ${pts[0].x},${pts[0].y} ` +
      `L ${pts[1].x},${pts[1].y} ` +
      `L ${pts[2].x},${pts[2].y} ` +
      `L ${pts[3].x},${pts[3].y} Z`;
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ width: imgRect.width, height: imgRect.height }}
      >
        <path
          d={d}
          fill="rgba(59, 130, 246, 0.08)"
          stroke="rgb(59, 130, 246)"
          strokeWidth="2"
        />
      </svg>
    );
  };

  // ハンドル
  const renderHandle = (key: CornerKey) => {
    if (!imgRect) return null;
    const disp = toDisplay(corners[key]);
    const isActive = activeCorner === key;
    return (
      <div
        key={key}
        className={`absolute touch-none select-none ${
          isActive ? "z-20" : "z-10"
        }`}
        style={{
          left: disp.x - 22,
          top: disp.y - 22,
          width: 44,
          height: 44,
        }}
        onPointerDown={handlePointerDown(key)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* リング (大) */}
        <div
          className={`absolute inset-0 rounded-full border-2 ${
            isActive
              ? "border-blue-600 bg-blue-100/60"
              : "border-blue-500 bg-white/20"
          }`}
        />
        {/* 中央点 */}
        <div className="absolute left-1/2 top-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full bg-blue-600" />
        {/* ラベル */}
        <div
          className="absolute text-[10px] font-bold text-blue-700 whitespace-nowrap"
          style={{
            left: key.endsWith("l") ? -2 : "auto",
            right: key.endsWith("r") ? -2 : "auto",
            top: key.startsWith("t") ? -16 : "auto",
            bottom: key.startsWith("b") ? -16 : "auto",
          }}
        >
          {CORNER_LABELS[key]}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          📐 {title ?? "傾きを手動で調整"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          キャンセル
        </button>
      </div>

      <p className="text-xs text-gray-600 mb-3 leading-snug">
        カードの<strong>四隅</strong>に4つのハンドル (青丸) を合わせてください。
        ドラッグ中は指の上に拡大鏡が出ます。完了したら「✓ 確定」を押すと再正面化します。
      </p>

      <div
        ref={containerRef}
        className="relative inline-block max-w-full bg-gray-100 rounded-lg overflow-hidden touch-none select-none"
        style={{ touchAction: "none" }}
      >
        <img
          ref={imgRef}
          src={`data:image/jpeg;base64,${originalImage}`}
          alt="傾き調整用 元画像"
          onLoad={refreshImgRect}
          draggable={false}
          className="block max-w-full h-auto"
          style={{ maxHeight: "70vh" }}
        />
        {imgRect && (
          <>
            {renderQuadPath()}
            {(["tl", "tr", "br", "bl"] as CornerKey[]).map((k) => renderHandle(k))}
            {renderMagnifier()}
          </>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => onConfirm(corners)}
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {loading ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              再正面化中...
            </>
          ) : (
            <>✓ 確定して再正面化</>
          )}
        </button>
        <button
          type="button"
          onClick={() => setCorners(initialCorners)}
          disabled={loading}
          className="px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ↺ 初期値に戻す
        </button>
      </div>
    </div>
  );
}
