import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "TCG Authority — ワンピ・ポケカの相場と AI 鑑定";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #be123c 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#fbbf24",
            letterSpacing: 4,
            marginBottom: 24,
          }}
        >
          TCG AUTHORITY
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.15,
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          ワンピカード・ポケカの
          <br />
          相場 &amp; AI 鑑定
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.85)",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          PSA10 倍率ランキング・状態別相場・型番特定
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            fontSize: 22,
            color: "rgba(255,255,255,0.75)",
          }}
        >
          <span>🃏 6,800+ カード収録</span>
          <span>•</span>
          <span>🏆 PSA10 / Raw 別相場</span>
          <span>•</span>
          <span>🆓 完全無料</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
