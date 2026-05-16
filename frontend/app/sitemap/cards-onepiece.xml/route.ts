/**
 * /sitemap/cards-onepiece.xml — image: タグ付き + 動的 priority/lastmod
 *
 * Google のクロール予算を SEO 価値の高いカードに集中させるため、
 * カードごとに以下のシグナルを sitemap に出す:
 *   - lastmod: cards.updated_at の最新 (= クローラーが情報を更新した日)
 *   - priority: PSA price ≥ priority 0.9 / 高レア 0.7 / 通常 0.4
 *   - changefreq: PSA/高レアは weekly、通常は monthly (実態に合わせる)
 */
import { NextResponse } from "next/server";
import { sbGet } from "../../../lib/supabase";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";

const BRAND = "onepiece";

const HIGH_RARITY = new Set([
  "SEC", "P-SEC", "L", "SP", "SR", "P-SR",
]);

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type CardRow = {
  id: string;
  set_code: string;
  card_no: string;
  image_url: string | null;
  name_ja: string;
  rarity: string | null;
  updated_at: string | null;
};

type Entry = {
  url: string;
  image: string | null;
  name: string;
  lastmod: string | null;
  priority: number;
  changefreq: string;
};

export async function GET() {
  let entries: Entry[] = [];
  try {
    const psaIds = new Set<string>();
    {
      const PAGE = 1000;
      for (let offset = 0; ; offset += PAGE) {
        const chunk = await sbGet<{ card_id: string }[]>(
          "card_grade_prices_latest",
          `select=card_id&limit=${PAGE}&offset=${offset}`,
        );
        for (const r of chunk) psaIds.add(r.card_id);
        if (chunk.length < PAGE) break;
      }
    }

    const PAGE = 1000;
    const grouped = new Map<
      string,
      {
        image: string | null;
        name: string;
        rarities: Set<string>;
        updated: string | null;
        hasPsa: boolean;
      }
    >();
    for (let offset = 0; ; offset += PAGE) {
      const chunk = await sbGet<CardRow[]>(
        "cards",
        `brand=eq.${BRAND}&select=id,set_code,card_no,image_url,name_ja,rarity,updated_at&order=set_code,card_no&limit=${PAGE}&offset=${offset}`,
      );
      for (const c of chunk) {
        const code = `${c.set_code}-${c.card_no}`;
        const cur = grouped.get(code);
        if (!cur) {
          grouped.set(code, {
            image: c.image_url,
            name: c.name_ja,
            rarities: new Set(c.rarity ? [c.rarity.toUpperCase()] : []),
            updated: c.updated_at,
            hasPsa: psaIds.has(c.id),
          });
        } else {
          if (!cur.image && c.image_url) cur.image = c.image_url;
          if (c.rarity) cur.rarities.add(c.rarity.toUpperCase());
          if (c.updated_at && (!cur.updated || c.updated_at > cur.updated)) {
            cur.updated = c.updated_at;
          }
          if (psaIds.has(c.id)) cur.hasPsa = true;
        }
      }
      if (chunk.length < PAGE) break;
    }

    entries = Array.from(grouped.entries()).map(([code, v]) => {
      const isHigh = Array.from(v.rarities).some((r) => HIGH_RARITY.has(r));
      let priority = 0.4;
      let changefreq = "monthly";
      if (v.hasPsa) {
        priority = 0.9;
        changefreq = "weekly";
      } else if (isHigh) {
        priority = 0.7;
        changefreq = "weekly";
      }
      return {
        url: `${SITE_URL}/cards/${code}`,
        image: v.image,
        name: v.name,
        lastmod: v.updated ? v.updated.slice(0, 10) : null,
        priority,
        changefreq,
      };
    });
    entries.sort((a, b) => b.priority - a.priority);
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
    const lastmodBlock = e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : "";
    return `  <url>
    <loc>${escapeXml(e.url)}</loc>${lastmodBlock}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>${imageBlock}
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
