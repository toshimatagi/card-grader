import { NextRequest, NextResponse } from "next/server";
import { sbGet } from "../../../../lib/supabase";
import type { CardSummary } from "../../../../lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const brand = sp.get("brand") || "onepiece";
  const setCode = sp.get("set");
  const cardNo = sp.get("card_no");
  const q = sp.get("q");
  const limit = Math.min(parseInt(sp.get("limit") || "12"), 50);

  const filters: string[] = [`brand=eq.${brand}`];
  if (setCode) filters.push(`set_code=eq.${setCode.toUpperCase()}`);
  if (cardNo) filters.push(`card_no=eq.${cardNo.padStart(3, "0")}`);
  if (q) filters.push(`name_ja=ilike.*${q}*`);

  const select = "id,brand,set_code,card_no,variant,rarity,name_ja,image_url";
  const qs =
    filters.join("&") +
    `&select=${select}` +
    `&order=set_code.asc,card_no.asc,variant.asc` +
    `&limit=${limit}`;

  try {
    const items = await sbGet<CardSummary[]>("cards", qs);
    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "search failed";
    return NextResponse.json({ items: [], count: 0, error: msg }, { status: 500 });
  }
}
