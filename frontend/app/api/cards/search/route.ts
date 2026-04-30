import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "../../../../lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const result = await searchCards({
      brand: sp.get("brand") || undefined,
      q: sp.get("q") || undefined,
      set_code: sp.get("set") || undefined,
      limit: Math.min(parseInt(sp.get("limit") || "12"), 50),
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "search failed";
    return NextResponse.json({ items: [], count: 0, error: msg }, { status: 500 });
  }
}
