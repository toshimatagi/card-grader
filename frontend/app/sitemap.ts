import type { MetadataRoute } from "next";
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
 *
 * cards-onepiece / cards-pokemon は image: タグ付きの XML を生成するため
 * route handler (app/sitemap/cards-{brand}.xml/route.ts) で別実装している。
 */
export async function generateSitemaps() {
  return [
    { id: "static" },
    { id: "sets" },
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

  return [];
}
