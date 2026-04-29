import { ImageResponse } from "next/og";
import { getGrade } from "../../../lib/api";

export const runtime = "edge";
export const alt = "TCG Authority 鑑定結果";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: { id: string } }) {
  let g;
  try {
    g = await getGrade(params.id);
  } catch {
    return fallback();
  }

  const overall = g.overall_grade.toFixed(1);
  const conf = Math.round(g.confidence * 100);
  const cells = [
    { label: "センタリング", v: g.sub_grades.centering.score.toFixed(1) },
    { label: "表面", v: g.sub_grades.surface.score.toFixed(1) },
    { label: "色印刷", v: g.sub_grades.color_print.score.toFixed(1) },
    { label: "エッジ", v: g.sub_grades.edges_corners.score.toFixed(1) },
  ];

  const overallColor =
    g.overall_grade >= 9 ? "#34d399" :
    g.overall_grade >= 7 ? "#60a5fa" :
    g.overall_grade >= 5 ? "#fbbf24" : "#f87171";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
          color: "white",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 32, opacity: 0.7, display: "flex" }}>
          TCG Authority — 自動鑑定結果
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: 30,
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 220,
              fontWeight: 800,
              lineHeight: 1,
              color: overallColor,
              display: "flex",
            }}
          >
            {overall}
          </div>
          <div style={{ fontSize: 48, opacity: 0.7, display: "flex" }}>
            / 10.0
          </div>
          <div
            style={{
              fontSize: 28,
              opacity: 0.6,
              marginLeft: "auto",
              display: "flex",
            }}
          >
            信頼度 {conf}%
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: "auto" }}>
          {cells.map((c) => (
            <div
              key={c.label}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: "20px 16px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ fontSize: 20, opacity: 0.7, display: "flex" }}>
                {c.label}
              </div>
              <div style={{ fontSize: 64, fontWeight: 700, display: "flex" }}>
                {c.v}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 24,
            opacity: 0.5,
            display: "flex",
          }}
        >
          tcg-authority.com
        </div>
      </div>
    ),
    { ...size }
  );
}

function fallback() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
          color: "white",
          fontSize: 80,
          fontWeight: 800,
        }}
      >
        TCG Authority
      </div>
    ),
    size
  );
}
