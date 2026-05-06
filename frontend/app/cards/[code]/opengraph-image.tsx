import { ImageResponse } from "next/og";
import { getCardByCode } from "../../../lib/api";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "TCG Authority - カード相場";

export default async function Image({
  params,
}: {
  params: { code: string };
}) {
  const code = params.code.toUpperCase();
  let cardName = code;
  let imageUrl: string | null = null;
  let setCode = "";
  let priceRange = "";
  let brandLabel = "TCG Authority";

  try {
    const data = await getCardByCode(code);
    if (data && data.cards.length > 0) {
      const first = data.cards[0];
      cardName = first.name_ja;
      imageUrl = first.image_url ?? null;
      setCode = first.set_code;
      brandLabel =
        first.brand === "pokemon"
          ? "ポケモンカード相場"
          : "ワンピカード相場";
      const sells = data.cards
        .map((c) => c.sell_price)
        .filter((p): p is number => p != null && p > 0);
      if (sells.length > 0) {
        const min = Math.min(...sells);
        const max = Math.max(...sells);
        priceRange =
          min !== max
            ? `¥${min.toLocaleString()} 〜 ¥${max.toLocaleString()}`
            : `¥${min.toLocaleString()}`;
      }
    }
  } catch {
    // フォールバック
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
          padding: 60,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingRight: 40,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#fbbf24",
                marginBottom: 12,
                letterSpacing: 2,
              }}
            >
              TCG AUTHORITY
            </div>
            <div
              style={{
                fontSize: 28,
                color: "rgba(255,255,255,0.7)",
                marginBottom: 8,
              }}
            >
              {brandLabel}
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                lineHeight: 1.1,
                marginBottom: 16,
                wordBreak: "break-word",
              }}
            >
              {cardName.length > 20 ? cardName.slice(0, 19) + "…" : cardName}
            </div>
            <div
              style={{
                fontSize: 28,
                color: "rgba(255,255,255,0.85)",
                marginBottom: 8,
              }}
            >
              {setCode ? `${setCode}・${code}` : code}
            </div>
            {priceRange && (
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: "#fbbf24",
                  marginTop: 12,
                }}
              >
                {priceRange}
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.6)",
              marginTop: 20,
            }}
          >
            販売中央値・買取相場・値上がりトレンドを無料チェック
          </div>
        </div>
        {imageUrl && (
          <div
            style={{
              width: 360,
              height: 504,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "4px solid rgba(251,191,36,0.6)",
              borderRadius: 16,
              overflow: "hidden",
              background: "rgba(0,0,0,0.2)",
            }}
          >
            <img
              src={imageUrl}
              alt={cardName}
              width={352}
              height={496}
              style={{ objectFit: "contain" }}
            />
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
