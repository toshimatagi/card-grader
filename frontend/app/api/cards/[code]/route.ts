import { NextRequest, NextResponse } from "next/server";
import { getCardByCode } from "../../../../lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  try {
    const data = await getCardByCode(code);
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    const status = msg.includes("見つかりません") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
