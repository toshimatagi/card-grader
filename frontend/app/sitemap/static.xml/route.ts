import { NextResponse } from "next/server";
import { recentWeekSlugs } from "../../../lib/weeks";

export const revalidate = 86400; // 24h

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export async function GET() {
  const urls = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/cards`, changeFrequency: "daily", priority: 0.95 },
    { url: `${SITE_URL}/cards/onepiece`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/cards/pokemon`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/trending`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/trending?brand=pokemon`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/trending/psa10`, changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE_URL}/trending/psa10?brand=pokemon`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/trending/psa10?brand=onepiece`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/trending/spread`, changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE_URL}/trending/spread?brand=pokemon`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/trending/spread?brand=onepiece`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/trending/raw`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/trending/raw?brand=pokemon`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/trending/raw?brand=onepiece`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/weekly`, changeFrequency: "weekly", priority: 0.7 },
    ...recentWeekSlugs(12).map((slug) => ({
      url: `${SITE_URL}/weekly/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: `${SITE_URL}/guide`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/guide/psa10-tousenritu`, changeFrequency: "monthly", priority: 0.75 },
    { url: `${SITE_URL}/guide/kantei-teisyutsu`, changeFrequency: "monthly", priority: 0.75 },
    { url: `${SITE_URL}/guide/mercari-takaku-uru`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/history`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
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
