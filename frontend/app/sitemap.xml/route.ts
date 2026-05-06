/**
 * sitemap index — generateSitemaps で /sitemap/{id}.xml に分割した
 * 各 sitemap を束ねる sitemapindex を /sitemap.xml で配信する。
 *
 * Search Console には /sitemap.xml を1つ登録すればOK。
 */
import type { NextRequest } from "next/server";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

const SITEMAPS = [
  "static",
  "sets",
  "cards-onepiece",
  "cards-pokemon",
];

export async function GET(_req: NextRequest): Promise<Response> {
  const lastmod = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAPS.map(
  (id) => `  <sitemap>
    <loc>${SITE_URL}/sitemap/${id}.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
).join("\n")}
</sitemapindex>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
