/**
 * /sitemap/cards-onepiece.xml — image: タグ付きカード詳細 sitemap
 *
 * Google 画像検索 (Google Images) からの流入を狙うため、各カード詳細URLに
 * <image:image><image:loc>...</image:loc>...</image:image> を付与した
 * Sitemap Image 拡張形式で出力する。
 *
 * Next.js MetadataRoute.Sitemap は image: namespace をサポートしないため、
 * 手書き XML route handler で配信。
 */
import { NextResponse } from "next/server";
import { sbGet } from "../../../lib/supabase";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

const BRAND = "onepiece";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  let entries: { url: string; image: string | null; name: string }[] = [];
  try {
    const PAGE = 1000;
    const seen = new Map<string, { image: string | null; name: string }>();
    for (let offset = 0; ; offset += PAGE) {
      const chunk = await sbGet<
        { set_code: string; card_no: string; image_url: string | null; name_ja: string }[]
      >(
        "cards",
        `brand=eq.${BRAND}&select=set_code,card_no,image_url,name_ja&order=set_code,card_no&limit=${PAGE}&offset=${offset}`,
      );
      for (const c of chunk) {
        const code = `${c.set_code}-${c.card_no}`;
        const cur = seen.get(code);
        if (!cur || (!cur.image && c.image_url)) {
          seen.set(code, { image: c.image_url, name: c.name_ja });
        }
      }
      if (chunk.length < PAGE) break;
    }
    entries = Array.from(seen.entries()).map(([code, v]) => ({
      url: `${SITE_URL}/cards/${code}`,
      image: v.image,
      name: v.name,
    }));
  } catch {
    // 疎通失敗時は空で返す
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries
  .map((e) => {
    const imageBlock = e.image
      ? `
    <image:image>
      <image:loc>${escapeXml(e.image)}</image:loc>
      <image:title>${escapeXml(e.name)}</image:title>
    </image:image>`
      : "";
    return `  <url>
    <loc>${escapeXml(e.url)}</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>${imageBlock}
  </url>`;
  })
  .join("\n")}
</urlset>`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
