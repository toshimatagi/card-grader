"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
  cardAspect?: number; // height / width (TCG: 88/63 ≈ 1.397)
};

const DEFAULT_ASPECT = 88 / 63;
const FRAME_PADDING_RATIO = 0.06; // 画面端からの余白比

// 自動スキャン
const AUTO_ANALYZE_INTERVAL_MS = 167; // ~6Hz
const AUTO_STABLE_MS = 1200; // この時間連続で OK が続いたら自動撮影 (誤検出防止に長めに)
const AUTO_INITIAL_GRACE_MS = 1000; // カメラ起動直後は自動撮影しない
const AUTO_DS_WIDTH = 320; // 解析用ダウンサンプル幅 (px)
const EDGE_PAD_DS = 5; // 枠端から内側/外側にずらすピクセル (DS座標)
const EDGE_SAMPLES = 14; // 各辺のサンプル数
const EDGE_CONTRAST_THRESHOLD = 22; // 0-255、内側-外側の平均輝度差
const EDGE_SAMPLE_HIT_RATIO = 0.35; // 各辺で contrast 闾値を超えるサンプルが何割必要か
const ALIGNED_EDGE_MIN = 3; // 4辺中いくつ通れば「枠合致」とみなすか (照明ムラ対策で 3/4 に緩和)

export default function CameraCapture({
  onCapture,
  onClose,
  cardAspect = DEFAULT_ASPECT,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const analyzeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tilt, setTilt] = useState<{ pitch: number; roll: number } | null>(null);
  const [orientationPermission, setOrientationPermission] = useState<
    "unknown" | "granted" | "denied" | "unsupported"
  >("unknown");
  const [capturing, setCapturing] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [aligned, setAligned] = useState(false);
  const [countdown, setCountdown] = useState(0); // 0..1 (自動撮影までの進捗)
  // カメラハードウェアズーム (対応端末のみ。Android Chrome / iOS Safari 15+ の背面カメラ等)
  const [zoomCaps, setZoomCaps] = useState<{
    min: number;
    max: number;
    step: number;
  } | null>(null);
  const [zoomValue, setZoomValue] = useState(1);
  const zoomValueRef = useRef(1);
  const pinchBaseDistRef = useRef<number | null>(null);
  const pinchBaseZoomRef = useRef(1);
  const readyAtRef = useRef<number | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  // 解析ループ内で最新値を読むための ref
  const tiltOkRef = useRef(false);
  const capturingRef = useRef(false);
  const autoScanRef = useRef(true);
  const captureRef = useRef<(() => void) | null>(null);

  // カメラ起動
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("このブラウザはカメラに対応していません");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
          readyAtRef.current = Date.now();

          // ハードウェアズーム capability の検出
          const track = stream.getVideoTracks()[0];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const caps = (track.getCapabilities as any)?.call(track) as
            | { zoom?: { min: number; max: number; step?: number } }
            | undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const settings = (track.getSettings as any)?.call(track) as
            | { zoom?: number }
            | undefined;
          if (caps?.zoom && typeof caps.zoom.min === "number") {
            setZoomCaps({
              min: caps.zoom.min,
              max: caps.zoom.max,
              step: caps.zoom.step ?? 0.1,
            });
            const initial = settings?.zoom ?? caps.zoom.min;
            setZoomValue(initial);
            zoomValueRef.current = initial;
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`カメラを起動できませんでした: ${msg}`);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // カメラハードウェアズームを適用
  const applyHardwareZoom = useCallback((next: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoomCaps) return;
    const clamped = Math.min(zoomCaps.max, Math.max(zoomCaps.min, next));
    zoomValueRef.current = clamped;
    setZoomValue(clamped);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    track.applyConstraints({ advanced: [{ zoom: clamped } as any] }).catch(() => {
      // 一部端末で applyConstraints が rejected されるが UI 上は値変更を維持
    });
  }, [zoomCaps]);

  // ピンチジェスチャ → ハードウェアズーム (ページのピンチズームを乗っ取る)
  // ※ React の onTouchMove は passive デフォルトなので preventDefault が効かない。
  //    native addEventListener で {passive: false} 指定が必須。
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function getDist(touches: TouchList): number {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchBaseDistRef.current = getDist(e.touches);
        pinchBaseZoomRef.current = zoomValueRef.current;
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchBaseDistRef.current != null) {
        e.preventDefault();
        if (!zoomCaps) return; // HW未対応端末は無視 (ページのピンチも touch-action: none で抑止済み)
        const dist = getDist(e.touches);
        const ratio = dist / pinchBaseDistRef.current;
        // ズーム範囲を倍率変化に対応 (例: 1→max まで指の動きにフィット)
        const targetSpan = zoomCaps.max - zoomCaps.min;
        const delta = (ratio - 1) * targetSpan * 0.7; // 感度調整
        applyHardwareZoom(pinchBaseZoomRef.current + delta);
      }
    }
    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        pinchBaseDistRef.current = null;
      }
    }

    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: false });
    container.addEventListener("touchcancel", onTouchEnd, { passive: false });
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [zoomCaps, applyHardwareZoom]);

  // 端末傾き (水平インジケータ用)
  // beta: 前後傾き (画面が天井向きで90°)
  // gamma: 左右傾き (-90°〜90°)
  // 「カードを机に置いて真上から撮る」= 画面が地面と平行下向き = beta ≈ 0、gamma ≈ 0
  // (注: iOS/Androidで揺れが大きいため低域通過で平滑化)
  useEffect(() => {
    let lastPitch = 0;
    let lastRoll = 0;
    let initialized = false;
    const ALPHA = 0.25; // 平滑化係数
    const handler = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      // 画面回転 (横持ち) を考慮: window.orientation で軸を補正
      const screenAngle =
        (window.screen?.orientation?.angle ??
          (typeof window.orientation === "number" ? window.orientation : 0)) || 0;
      let rawPitch: number;
      let rawRoll: number;
      // 縦持ち基準。横持ち時は beta/gamma を入れ替え＆符号反転
      switch (screenAngle) {
        case 90:
          rawPitch = -e.gamma;
          rawRoll = e.beta;
          break;
        case -90:
        case 270:
          rawPitch = e.gamma;
          rawRoll = -e.beta;
          break;
        case 180:
          rawPitch = -e.beta;
          rawRoll = -e.gamma;
          break;
        default:
          rawPitch = e.beta;
          rawRoll = e.gamma;
      }
      if (!initialized) {
        lastPitch = rawPitch;
        lastRoll = rawRoll;
        initialized = true;
      } else {
        lastPitch = lastPitch * (1 - ALPHA) + rawPitch * ALPHA;
        lastRoll = lastRoll * (1 - ALPHA) + rawRoll * ALPHA;
      }
      setTilt({ pitch: lastPitch, roll: lastRoll });
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, []);

  const requestOrientation = useCallback(async () => {
    type DOEWithReq = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const D = DeviceOrientationEvent as DOEWithReq | undefined;
    if (!D) {
      setOrientationPermission("unsupported");
      return;
    }
    if (typeof D.requestPermission === "function") {
      try {
        const res = await D.requestPermission();
        setOrientationPermission(res === "granted" ? "granted" : "denied");
      } catch {
        setOrientationPermission("denied");
      }
    } else {
      setOrientationPermission("granted");
    }
  }, []);

  // 撮影 → File 変換
  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready) return;
    setCapturing(true);
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        setError("映像サイズが取得できませんでした");
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Canvas が初期化できませんでした");
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("撮影画像の生成に失敗しました");
            setCapturing(false);
            return;
          }
          const filename = `card-${Date.now()}.jpg`;
          const file = new File([blob], filename, { type: "image/jpeg" });
          onCapture(file);
          setCapturing(false);
        },
        "image/jpeg",
        0.92
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "撮影に失敗しました");
      setCapturing(false);
    }
  }, [ready, onCapture]);

  // 水平判定 (机置き真上撮影想定: pitch≈0, roll≈0)
  const TILT_THRESHOLD = 10; // 度
  const tiltOk =
    tilt != null &&
    Math.abs(tilt.pitch) <= TILT_THRESHOLD &&
    Math.abs(tilt.roll) <= TILT_THRESHOLD;
  const tiltActive = tilt != null;

  // 解析ループから読むため refs を最新値に同期
  useEffect(() => {
    tiltOkRef.current = tiltOk;
  }, [tiltOk]);
  useEffect(() => {
    capturingRef.current = capturing;
  }, [capturing]);
  useEffect(() => {
    autoScanRef.current = autoScan;
  }, [autoScan]);
  useEffect(() => {
    captureRef.current = capture;
  }, [capture]);

  // 自動スキャン: video から枠領域の4辺コントラストを定期解析し、
  //   水平OK + 枠一致 が AUTO_STABLE_MS 連続で成立したら capture()
  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      if (stopped) return;
      analyze();
      timer = setTimeout(run, AUTO_ANALYZE_INTERVAL_MS);
    };

    const analyze = () => {
      const video = videoRef.current;
      const container = containerRef.current;
      const frameDiv = frameRef.current;
      if (!video || !container || !frameDiv) return;
      const Vw = video.videoWidth;
      const Vh = video.videoHeight;
      if (!Vw || !Vh) return;

      // object-cover で表示された video の container 内位置 → video pixel に逆変換
      const cR = container.getBoundingClientRect();
      const fR = frameDiv.getBoundingClientRect();
      if (cR.width === 0 || cR.height === 0) return;
      const scale = Math.max(cR.width / Vw, cR.height / Vh);
      const offX = (cR.width - Vw * scale) / 2;
      const offY = (cR.height - Vh * scale) / 2;
      const fxV = (fR.left - cR.left - offX) / scale;
      const fyV = (fR.top - cR.top - offY) / scale;
      const fwV = fR.width / scale;
      const fhV = fR.height / scale;

      // ダウンサンプルして getImageData
      const dsScale = AUTO_DS_WIDTH / Vw;
      const DS_W = AUTO_DS_WIDTH;
      const DS_H = Math.max(1, Math.round(Vh * dsScale));
      let canvas = analyzeCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        analyzeCanvasRef.current = canvas;
      }
      if (canvas.width !== DS_W || canvas.height !== DS_H) {
        canvas.width = DS_W;
        canvas.height = DS_H;
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      try {
        ctx.drawImage(video, 0, 0, DS_W, DS_H);
      } catch {
        return;
      }
      let imgData: ImageData;
      try {
        imgData = ctx.getImageData(0, 0, DS_W, DS_H);
      } catch {
        return;
      }

      const fxDS = fxV * dsScale;
      const fyDS = fyV * dsScale;
      const fwDS = fwV * dsScale;
      const fhDS = fhV * dsScale;

      const isAligned = checkFrameAlignment(imgData, fxDS, fyDS, fwDS, fhDS);
      setAligned(isAligned);

      // 自動撮影タイマー
      if (!autoScanRef.current || capturingRef.current) {
        if (stableSinceRef.current != null) {
          stableSinceRef.current = null;
          setCountdown(0);
        }
        return;
      }
      const now = Date.now();
      const sinceReady = readyAtRef.current ? now - readyAtRef.current : 0;
      const ok = tiltOkRef.current && isAligned && sinceReady >= AUTO_INITIAL_GRACE_MS;
      if (ok) {
        if (stableSinceRef.current == null) stableSinceRef.current = now;
        const elapsed = now - stableSinceRef.current;
        setCountdown(Math.min(1, elapsed / AUTO_STABLE_MS));
        if (elapsed >= AUTO_STABLE_MS) {
          stableSinceRef.current = null;
          setCountdown(0);
          captureRef.current?.();
        }
      } else if (stableSinceRef.current != null) {
        stableSinceRef.current = null;
        setCountdown(0);
      }
    };

    run();
    return () => {
      stopped = true;
      if (timer != null) clearTimeout(timer);
    };
  }, [ready]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* ヘッダ */}
      <div className="flex items-center justify-between px-4 py-3 text-white bg-black/70">
        <button
          onClick={onClose}
          className="text-sm px-3 py-1.5 border border-white/30 rounded hover:bg-white/10"
        >
          ✕ 閉じる
        </button>
        <div className="text-center flex-1 px-2">
          {tiltActive ? (
            <div className={tiltOk ? "text-green-400" : "text-yellow-300"}>
              <div className="text-sm font-bold">
                {tiltOk ? "● 水平 OK" : "▲ 傾き調整中"}
              </div>
              <div className="text-[10px] text-white/70 mt-0.5">
                前後 {Math.round(tilt!.pitch)}° / 左右 {Math.round(tilt!.roll)}°
              </div>
            </div>
          ) : orientationPermission === "unknown" ? (
            <button
              onClick={requestOrientation}
              className="px-3 py-1.5 bg-blue-600 rounded text-xs font-medium"
            >
              水平センサーを有効化
            </button>
          ) : orientationPermission === "denied" ? (
            <span className="text-red-300 text-xs">水平センサー拒否</span>
          ) : orientationPermission === "unsupported" ? (
            <span className="text-gray-400 text-xs">水平センサー非対応</span>
          ) : (
            <span className="text-gray-400 text-xs">水平センサー待機中</span>
          )}
        </div>
        <div className="w-16" />
      </div>

      {/* カメラビュー + オーバーレイ */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-black"
        // ブラウザ標準のピンチズームを無効化 (フレーム overlay とのズレ防止)。
        // 代わりにカメラハードウェアズームを上の useEffect で実装。
        style={{ touchAction: "none" }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* SVG オーバーレイ: カード枠 + 水平ライン */}
        <FrameOverlay
          cardAspect={cardAspect}
          tilt={tilt}
          tiltOk={tiltOk}
          aligned={aligned}
          frameRef={frameRef}
        />

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
            <span className="animate-spin inline-block w-6 h-6 border-2 border-white border-t-transparent rounded-full mr-3" />
            カメラ起動中...
          </div>
        )}

        {error && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 p-4 bg-red-900/80 text-white rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* ズームスライダー (HW対応端末のみ表示。ピンチ操作中も連動して動く) */}
        {zoomCaps && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 bg-black/50 rounded-full px-2 py-3 backdrop-blur-sm">
            <button
              type="button"
              onClick={() =>
                applyHardwareZoom(Math.min(zoomCaps.max, zoomValue + zoomCaps.step * 4))
              }
              className="text-white text-lg w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="ズーム+"
            >
              ＋
            </button>
            <input
              type="range"
              min={zoomCaps.min}
              max={zoomCaps.max}
              step={zoomCaps.step}
              value={zoomValue}
              onChange={(e) => applyHardwareZoom(parseFloat(e.target.value))}
              className="appearance-none w-32 h-1 bg-white/30 rounded-full"
              style={{
                writingMode: "vertical-lr" as const,
                WebkitAppearance: "slider-vertical" as never,
              }}
              aria-label="カメラズーム"
            />
            <button
              type="button"
              onClick={() =>
                applyHardwareZoom(Math.max(zoomCaps.min, zoomValue - zoomCaps.step * 4))
              }
              className="text-white text-lg w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="ズーム−"
            >
              −
            </button>
            <span className="text-white text-[10px] tabular-nums">
              ×{zoomValue.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* フッタ: 撮影ボタン */}
      <div className="bg-black/80 py-6 flex items-center justify-center gap-6">
        {/* 左: AUTO トグル */}
        <button
          onClick={() => setAutoScan((v) => !v)}
          disabled={!ready}
          className={`w-14 h-14 rounded-full border text-[10px] font-bold leading-tight flex flex-col items-center justify-center transition-colors ${
            autoScan
              ? "border-green-400 bg-green-400/15 text-green-300"
              : "border-white/40 bg-white/5 text-white/70"
          } disabled:opacity-40`}
          aria-label="自動スキャン"
          aria-pressed={autoScan}
        >
          <span>AUTO</span>
          <span className="text-[9px] opacity-80">{autoScan ? "ON" : "OFF"}</span>
        </button>

        {/* 中央: 撮影ボタン (自動撮影カウントダウンリング付き) */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          {autoScan && countdown > 0 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="rgb(74, 222, 128)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - countdown)}`}
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dashoffset 100ms linear" }}
              />
            </svg>
          )}
          <button
            onClick={capture}
            disabled={!ready || capturing}
            className={`w-20 h-20 rounded-full border-4 transition-all ${
              autoScan && aligned && tiltOk
                ? "border-green-400 bg-white scale-105"
                : tiltOk
                ? "border-green-400 bg-white hover:scale-105"
                : "border-white bg-white hover:scale-105"
            } ${
              !ready || capturing ? "opacity-40 cursor-not-allowed" : ""
            }`}
            aria-label="撮影"
          >
            <span className="block w-full h-full rounded-full bg-white" />
          </button>
        </div>

        {/* 右: ステータス文言 */}
        <div className="w-14 text-center text-[10px] leading-tight">
          {autoScan ? (
            !tiltOk ? (
              <span className="text-yellow-300">水平を整える</span>
            ) : !aligned ? (
              <span className="text-yellow-300">枠に合わせる</span>
            ) : countdown > 0 ? (
              <span className="text-green-300">自動撮影中…</span>
            ) : (
              <span className="text-green-300">準備OK</span>
            )
          ) : tiltOk ? (
            <span className="text-green-300">撮影OK</span>
          ) : tiltActive ? (
            <span className="text-yellow-300">傾き注意</span>
          ) : (
            <span className="text-white/60">手動</span>
          )}
        </div>
      </div>
    </div>
  );
}

function FrameOverlay({
  cardAspect,
  tilt,
  tiltOk,
  aligned,
  frameRef,
}: {
  cardAspect: number;
  tilt: { pitch: number; roll: number } | null;
  tiltOk: boolean;
  aligned: boolean;
  frameRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  // SVG viewBox 100x100 で計算し、preserveAspectRatio で全画面に伸ばす方式は枠比が崩れる。
  // ここでは div + パーセンテージ + アスペクト比指定で枠を出す。
  const allOk = tiltOk && aligned;
  const frameColor = allOk
    ? "rgb(74, 222, 128)"
    : aligned
    ? "rgb(125, 211, 252)" // sky-300: 枠OKだが水平NG
    : "rgb(255, 255, 255)";

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* 周辺マスク (枠外を半透明で暗く) */}
      <div className="absolute inset-0 bg-black/35" />

      {/* カード枠 */}
      <div
        ref={frameRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: `${(1 - FRAME_PADDING_RATIO * 2) * 100}%`,
          maxWidth: `min(90vw, ${(95 / cardAspect)}vh)`,
          aspectRatio: `1 / ${cardAspect}`,
        }}
      >
        {/* 枠外を背景色クリア (擬似的に "穴" を作る代わりに透明度を上書き) */}
        <div
          className="absolute inset-0 rounded-md transition-colors"
          style={{
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            border: `2px solid ${frameColor}`,
            borderRadius: "8px",
          }}
        />
        {/* 4角コーナー */}
        {(["tl", "tr", "bl", "br"] as const).map((pos) => (
          <span
            key={pos}
            className="absolute w-6 h-6"
            style={{
              top: pos.startsWith("t") ? -2 : "auto",
              bottom: pos.startsWith("b") ? -2 : "auto",
              left: pos.endsWith("l") ? -2 : "auto",
              right: pos.endsWith("r") ? -2 : "auto",
              borderTop: pos.startsWith("t") ? `4px solid ${frameColor}` : "none",
              borderBottom: pos.startsWith("b") ? `4px solid ${frameColor}` : "none",
              borderLeft: pos.endsWith("l") ? `4px solid ${frameColor}` : "none",
              borderRight: pos.endsWith("r") ? `4px solid ${frameColor}` : "none",
            }}
          />
        ))}

        {/* 中央十字 */}
        <span
          className="absolute left-1/2 top-1/2 w-px h-6 -translate-x-1/2 -translate-y-1/2 bg-white/50"
        />
        <span
          className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-white/50"
        />

        {/* 水平ガイドバブル (上中央) */}
        {tilt != null && (
          <HorizonBubble pitch={tilt.pitch} roll={tilt.roll} ok={tiltOk} />
        )}
      </div>

      {/* 下部ヒント */}
      <div className="absolute left-0 right-0 bottom-3 text-center text-white text-xs px-4 drop-shadow leading-snug">
        カードの<strong>四隅</strong>がすべて見えるように外枠に合わせて撮影してください。
        <br />
        反射・ピンボケ・斜め撮影は判定精度が下がります。
      </div>
    </div>
  );
}

function HorizonBubble({
  pitch,
  roll,
  ok,
}: {
  pitch: number;
  roll: number;
  ok: boolean;
}) {
  // カメラアプリ風: 中央に固定の基準線、端末の傾きに同期して動く可動線。
  // - roll で線が回転 (右に傾けたら線が時計回りに見える)
  // - pitch で線が上下にズレ (奥に傾けたら下に、手前に傾けたら上に)
  const clamp = (n: number, max: number) => Math.max(-max, Math.min(max, n));
  const dy = (clamp(pitch, 30) / 30) * 30; // 最大±30px
  const rotation = clamp(roll, 45); // 最大±45°
  const movingColor = ok ? "rgb(74, 222, 128)" : "rgb(253, 224, 71)";

  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 pointer-events-none">
      {/* 外周ターゲット円 */}
      <div className="absolute inset-0 rounded-full border border-white/30" />

      {/* 中央 (基準) 水平線 */}
      <span className="absolute top-1/2 left-3 right-3 h-px -mt-px bg-white/40" />
      {/* 中央点 */}
      <span className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-white/80" />

      {/* 可動線 (端末傾きに同期) */}
      <span
        className="absolute top-1/2 left-3 right-3 h-0.5 -mt-0.5 rounded-full transition-colors duration-150"
        style={{
          backgroundColor: movingColor,
          transform: `translateY(${dy}px) rotate(${rotation}deg)`,
          transformOrigin: "center",
        }}
      />

      {/* 水平OKチェック (中央) */}
      {ok && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-green-400 text-2xl font-bold drop-shadow">
          ✓
        </span>
      )}
    </div>
  );
}

// ガイド枠の4辺すべてで「内側 vs 外側」の輝度差が閾値超えなら、
// カード端が枠端と一致していると判断する。
// fx/fy/fw/fh はダウンサンプル後の枠領域 (DS座標)。
function checkFrameAlignment(
  imgData: ImageData,
  fx: number,
  fy: number,
  fw: number,
  fh: number
): boolean {
  const W = imgData.width;
  const H = imgData.height;
  const data = imgData.data;
  // 枠が画面外まではみ出していたらNG扱い (端の処理が不安定なため)
  if (
    fx - EDGE_PAD_DS < 0 ||
    fy - EDGE_PAD_DS < 0 ||
    fx + fw + EDGE_PAD_DS >= W ||
    fy + fh + EDGE_PAD_DS >= H ||
    fw < 20 ||
    fh < 20
  ) {
    return false;
  }
  const lum = (x: number, y: number): number => {
    const xi = Math.max(0, Math.min(W - 1, Math.floor(x)));
    const yi = Math.max(0, Math.min(H - 1, Math.floor(y)));
    const i = (yi * W + xi) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };
  const checkEdge = (
    pointAt: (t: number) => { ix: number; iy: number; ox: number; oy: number }
  ): boolean => {
    let total = 0;
    let hits = 0;
    for (let i = 0; i < EDGE_SAMPLES; i++) {
      const t = (i + 0.5) / EDGE_SAMPLES;
      const { ix, iy, ox, oy } = pointAt(t);
      const diff = Math.abs(lum(ix, iy) - lum(ox, oy));
      total += diff;
      if (diff >= EDGE_CONTRAST_THRESHOLD) hits++;
    }
    // 平均だけでなく、辺の大半 (60%) のサンプルでコントラストが
    // しっかり出ていることを要求 (1-2点だけ強い差が出る背景模様で
    // 誤判定するのを防ぐ)
    const avgOk = total / EDGE_SAMPLES >= EDGE_CONTRAST_THRESHOLD;
    const hitOk = hits / EDGE_SAMPLES >= EDGE_SAMPLE_HIT_RATIO;
    return avgOk && hitOk;
  };
  const top = checkEdge((t) => ({
    ix: fx + fw * t,
    iy: fy + EDGE_PAD_DS,
    ox: fx + fw * t,
    oy: fy - EDGE_PAD_DS,
  }));
  const bottom = checkEdge((t) => ({
    ix: fx + fw * t,
    iy: fy + fh - EDGE_PAD_DS,
    ox: fx + fw * t,
    oy: fy + fh + EDGE_PAD_DS,
  }));
  const left = checkEdge((t) => ({
    ix: fx + EDGE_PAD_DS,
    iy: fy + fh * t,
    ox: fx - EDGE_PAD_DS,
    oy: fy + fh * t,
  }));
  const right = checkEdge((t) => ({
    ix: fx + fw - EDGE_PAD_DS,
    iy: fy + fh * t,
    ox: fx + fw + EDGE_PAD_DS,
    oy: fy + fh * t,
  }));
  // 4辺全て合致は照明ムラに弱い。ALIGNED_EDGE_MIN 辺以上で OK とする (デフォ 3/4)
  const passed = (top ? 1 : 0) + (bottom ? 1 : 0) + (left ? 1 : 0) + (right ? 1 : 0);
  return passed >= ALIGNED_EDGE_MIN;
}
