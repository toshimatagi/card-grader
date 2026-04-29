const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

function headers(): HeadersInit {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function sbGet<T = unknown>(
  path: string,
  params?: string
): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase 環境変数未設定 (SUPABASE_URL / SUPABASE_SERVICE_KEY)");
  }
  const url = params
    ? `${SUPABASE_URL}/rest/v1/${path}?${params}`
    : `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function sbRpc<T = unknown>(
  fn: string,
  body: Record<string, unknown>
): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase 環境変数未設定 (SUPABASE_URL / SUPABASE_SERVICE_KEY)");
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase RPC ${fn} ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}
