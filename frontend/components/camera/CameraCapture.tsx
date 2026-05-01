"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
  cardAspect?: number; // height / width (TCG: 88/63 ≈ 1.397)
};

const DEFAULT_ASPECT = 88 / 63;
const FRAME_PADDING_RATIO = 0.06; // 画面端からの余白比

export default function CameraCapture({
  onCapture,
  onClose,
  cardAspect = DEFAULT_ASPECT,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tilt, setTilt] = useState<{ pitch: number; roll: number } | null>(null);
  const [orientationPermission, setOrientationPermission] = useState<
    "unknown" | "granted" | "denied" | "unsupported"
  >("unknown");
  const [capturing, setCapturing] = useState(false);

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
      <div className="relative flex-1 overflow-hidden bg-black">
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
      </div>

      {/* フッタ: 撮影ボタン */}
      <div className="bg-black/80 py-6 flex items-center justify-center gap-6">
        <div className="w-12" />
        <button
          onClick={capture}
          disabled={!ready || capturing}
          className={`w-20 h-20 rounded-full border-4 transition-all ${
            tiltOk
              ? "border-green-400 bg-white hover:scale-105"
              : "border-white bg-white hover:scale-105"
          } ${
            !ready || capturing ? "opacity-40 cursor-not-allowed" : ""
          }`}
          aria-label="撮影"
        >
          <span className="block w-full h-full rounded-full bg-white" />
        </button>
        <div className="w-12 text-center text-white text-[10px] leading-tight">
          {tiltOk ? "撮影OK" : tiltActive ? "傾き注意" : ""}
        </div>
      </div>
    </div>
  );
}

function FrameOverlay({
  cardAspect,
  tilt,
  tiltOk,
}: {
  cardAspect: number;
  tilt: { pitch: number; roll: number } | null;
  tiltOk: boolean;
}) {
  // SVG viewBox 100x100 で計算し、preserveAspectRatio で全画面に伸ばす方式は枠比が崩れる。
  // ここでは div + パーセンテージ + アスペクト比指定で枠を出す。
  const frameColor = tiltOk ? "rgb(74, 222, 128)" : "rgb(255, 255, 255)";

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* 周辺マスク (枠外を半透明で暗く) */}
      <div className="absolute inset-0 bg-black/35" />

      {/* カード枠 */}
      <div
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
      <div className="absolute left-0 right-0 bottom-3 text-center text-white text-xs px-4 drop-shadow">
        カード全体を枠内に収め、画面と平行に保ってください
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
