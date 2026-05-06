import { ImageResponse } from "next/og";
import { getOnePieceSetMeta } from "../../../../lib/onepieceSets";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "TCG Authority - ワンピカード価格DB";

export default async function Image({
  params,
}: {
  params: { set: string };
}) {
  const setCode = params.set.toUpperCase();
  const meta = getOnePieceSetMeta(setCode);
  const setName = meta?.name ?? setCode;
  const releaseDate = meta?.releaseDate ?? "";
  const kind = meta?.kind ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #fef2f2 0%, #fb7185 50%, #be123c 100%)",
          color: "#1f2937",
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#7f1d1d",
              marginBottom: 16,
              letterSpacing: 2,
            }}
          >
            TCG AUTHORITY ・ ワンピカード価格DB
          </div>
          <div
            style={{
              fontSize: 36,
              color: "#991b1b",
              marginBottom: 12,
            }}
          >
            {setCode}
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: 24,
              color: "#1f2937",
            }}
          >
            {setName}
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#374151",
            }}
          >
            {releaseDate && `${releaseDate} 発売`}
            {releaseDate && kind && "  ・  "}
            {kind && kind}
          </div>
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#7f1d1d",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 24,
            borderTop: "3px solid #991b1b",
          }}
        >
          <span>全カード相場・値上がりランキング</span>
          <span style={{ fontSize: 28 }}>tcg-authority.com</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
