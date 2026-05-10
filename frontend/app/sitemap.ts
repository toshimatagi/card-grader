import type { MetadataRoute } from "next";
import { sbGet } from "../lib/supabase";
import { POKEMON_SETS } from "../lib/pokemonSets";
import { ONEPIECE_SETS } from "../lib/onepieceSets";
import { recentWeekSlugs } from "../lib/weeks";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

export const revalidate = 86400; // 24h

/**
 * Next.js の generateSitemaps で sitemap を分割。
 * - /sitemap.xml (index) が `/sitemap/{id}.xml` 群を束ねる
 * - 静的・セット別ランディング・カード詳細を分離して PostgREST 取得負荷を分散、
 *   かつ Search Console で URL 数を内訳ごとにモニタしやすくする
 */
export async function generateSitemaps() {
  return [
    { id: "static" },
    { id: "sets" },
    { id: "cards-onepiece" },
    { id: "cards-pokemon" },
  ];
}

export default async function sitemap({
  id,
}: {
  id: string;
}): Promise<MetadataRoute.Sitemap> {
  if (id === "static") {
    return [
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
      { url: `${SITE_URL}/guide`, changeFrequency: "monthly", priority: 0.5 },
      { url: `${SITE_URL}/history`, changeFrequency: "monthly", priority: 0.3 },
    ];
  }

  if (id === "sets") {
    const entries: MetadataRoute.Sitemap = [];
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
    return entries;
  }

  if (id === "cards-onepiece" || id === "cards-pokemon") {
    const brand = id === "cards-onepiece" ? "onepiece" : "pokemon";
    const entries: MetadataRoute.Sitemap = [];
    try {
      const PAGE = 1000;
      const all: { set_code: string; card_no: string }[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const chunk = await sbGet<{ set_code: string; card_no: string }[]>(
          "cards",
          `brand=eq.${brand}&select=set_code,card_no&order=set_code,card_no&limit=${PAGE}&offset=${offset}`,
        );
        all.push(...chunk);
        if (chunk.length < PAGE) break;
      }
      const seen = new Set<string>();
      for (const c of all) {
        const code = `${c.set_code}-${c.card_no}`;
        if (seen.has(code)) continue;
        seen.add(code);
        entries.push({
          url: `${SITE_URL}/cards/${code}`,
          changeFrequency: "daily",
          priority: 0.7,
        });
      }
    } catch {
      // Supabase 疎通失敗時は空で返す (sitemap index は他を残す)
    }
    return entries;
  }

  return [];
}
