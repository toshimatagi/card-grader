export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return Response.json({ error: "NEXT_PUBLIC_API_URL not set" }, { status: 500 });
  }

  const start = Date.now();
  try {
    const res = await fetch(`${backendUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    return Response.json({
      ok: res.ok,
      status: res.status,
      ms: Date.now() - start,
    });
  } catch (e) {
    return Response.json({
      ok: false,
      error: e instanceof Error ? e.message : "unknown",
      ms: Date.now() - start,
    });
  }
}
