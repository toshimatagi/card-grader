import { NextResponse } from "next/server";
import { POKEMON_SETS } from "../../../lib/pokemonSets";
import { ONEPIECE_SETS } from "../../../lib/onepieceSets";

export const revalidate = 86400; // 24h

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export async function GET() {
  const entries: { url: string; changeFrequency: string; priority: number }[] = [];

  for (const code of Object.keys(ONEPIECE_SETS)) {
    entries.push({
      url: `${SITE_URL}/cards/onepiece/${code}`,
      changeFrequency: "daily",
      priority: 0.85,
    });
  }
  for (const code of Object.keys(POKEMON_SETS)) {
    entries.push({
      url: `${SITE_URL}/cards/pokemon/${code}`,
      changeFrequency: "daily",
      priority: 0.85,
    });
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${e.url}</loc>
    <changefreq>${e.changeFrequency}</changefreq>
    <priority>${e.priority.toFixed(2)}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
