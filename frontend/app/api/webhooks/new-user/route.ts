/**
 * 新規ユーザー登録通知 — Supabase Database Webhook 受け口
 *
 * 流れ: user_profiles に INSERT → Supabase が pg_net 経由でここに POST
 *   → Discord webhook 用にフォーマット変換 → Discord に転送
 *
 * セキュリティ: x-webhook-secret ヘッダで Supabase からのリクエストか検証
 * (これがないと第三者が偽の通知を流せてしまう)
 *
 * PII方針: email/本名 は通知に含めない (display_name と統計のみ)
 */
import { NextResponse } from "next/server";
import { sbGet } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

type SupabaseWebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id?: string;
    display_name?: string | null;
    created_at?: string;
    plan?: string;
  } | null;
  old_record: unknown;
};

export async function POST(request: Request) {
  // 1. 認証
  const providedSecret = request.headers.get("x-webhook-secret");
  if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!DISCORD_WEBHOOK_URL) {
    return NextResponse.json(
      { error: "discord webhook url not configured" },
      { status: 503 },
    );
  }

  // 2. payload パース
  let payload: SupabaseWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.table !== "user_profiles") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const record = payload.record ?? {};
  const displayName = record.display_name ?? "(名前未設定)";
  const createdAt = record.created_at ?? new Date().toISOString();

  // 3. 累計ユーザー数 (簡易統計)
  let totalUsers: number | null = null;
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/user_profiles?select=id`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY ?? "",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY ?? ""}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
        cache: "no-store",
      },
    );
    const contentRange = res.headers.get("content-range");
    if (contentRange) {
      const parts = contentRange.split("/");
      totalUsers = parseInt(parts[parts.length - 1], 10) || null;
    }
  } catch {
    // 統計取得失敗は無視 (本機能は通知が最優先)
  }

  // 4. Discord embed 形式に変換
  const discordPayload = {
    username: "TCG Authority",
    embeds: [
      {
        title: "🆕 新規ユーザー登録",
        color: 0x4caf50,
        fields: [
          { name: "表示名", value: displayName, inline: true },
          {
            name: "登録日時",
            value: new Date(createdAt).toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }),
            inline: true,
          },
          ...(totalUsers != null
            ? [{ name: "累計ユーザー数", value: `${totalUsers}人`, inline: true }]
            : []),
        ],
        footer: { text: "tcg-authority.com" },
        timestamp: createdAt,
      },
    ],
  };

  // 5. Discord に転送
  const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(discordPayload),
  });

  if (!discordRes.ok) {
    const text = await discordRes.text().catch(() => "");
    return NextResponse.json(
      { error: `discord ${discordRes.status}`, detail: text.slice(0, 200) },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

// GET で疎通確認できるよう (Vercel 上のヘルスチェック用)
export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: {
      webhook_secret: !!WEBHOOK_SECRET,
      discord_url: !!DISCORD_WEBHOOK_URL,
    },
  });
}
