const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

function headers(): HeadersInit {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

/**
 * Supabase REST GET wrapper.
 *
 * デフォルトで Next.js Data Cache に 60秒入れる (revalidate=60)。
 * Vercel が iad1 (US East) でDBが ap-south-1 (Mumbai) なので
 * 1クエリ往復 ~500ms → キャッシュHIT で ~5ms に短縮できる。
 *
 * @param revalidate キャッシュ秒数。0 で no-store (常に最新)。null で fetch default
 */
export async function sbGet<T = unknown>(
  path: string,
  params?: string,
  revalidate: number | null = 60,
): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase 環境変数未設定 (SUPABASE_URL / SUPABASE_SERVICE_KEY)");
  }
  const url = params
    ? `${SUPABASE_URL}/rest/v1/${path}?${params}`
    : `${SUPABASE_URL}/rest/v1/${path}`;
  const init: RequestInit & { next?: { revalidate?: number } } = {
    headers: headers(),
  };
  if (revalidate === 0) {
    init.cache = "no-store";
  } else if (revalidate != null) {
    init.next = { revalidate };
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function sbRpc<T = unknown>(
  fn: string,
  body: Record<string, unknown>,
  revalidate: number | null = 60,
): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase 環境変数未設定 (SUPABASE_URL / SUPABASE_SERVICE_KEY)");
  }
  const init: RequestInit & { next?: { revalidate?: number } } = {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  };
  if (revalidate === 0) {
    init.cache = "no-store";
  } else if (revalidate != null) {
    init.next = { revalidate };
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase RPC ${fn} ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}
