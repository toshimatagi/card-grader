import type { MetadataRoute } from "next";
import { sbGet } from "../lib/supabase";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export const revalidate = 86400; // 24h

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/cards`, changeFrequency: "daily", priority: 0.95 },
    { url: `${SITE_URL}/cards/onepiece`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/cards/pokemon`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/trending`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/trending?brand=pokemon`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/guide`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/history`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // 全カードコードを取得 (両ブランド合算)
  const cardEntries: MetadataRoute.Sitemap = [];
  try {
    const PAGE = 1000;
    const all: { set_code: string; card_no: string }[] = [];
    for (const brand of ["onepiece", "pokemon"]) {
      for (let offset = 0; ; offset += PAGE) {
        const chunk = await sbGet<{ set_code: string; card_no: string }[]>(
          "cards",
          `brand=eq.${brand}&select=set_code,card_no&order=set_code,card_no&limit=${PAGE}&offset=${offset}`
        );
        all.push(...chunk);
        if (chunk.length < PAGE) break;
      }
    }
    const seen = new Set<string>();
    for (const c of all) {
      const code = `${c.set_code}-${c.card_no}`;
      if (seen.has(code)) continue;
      seen.add(code);
      cardEntries.push({
        url: `${SITE_URL}/cards/${code}`,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  } catch {
    // Supabase疎通失敗時は静的のみ返す
  }

  return [...staticEntries, ...cardEntries];
}
