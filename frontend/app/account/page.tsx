import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import AccountForm from "./AccountForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "アカウント設定",
  robots: { index: false, follow: false },
  description: "TCG Authority のアカウント設定。表示名の変更、ログアウト。",
};

export default async function AccountPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, plan, created_at")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">アカウント設定</h1>
      <p className="text-xs text-gray-500 mb-6">
        TCG Authority はメールアドレスや本名をユーザー画面に表示しません。
        Google認証は識別子としてのみ使用しています。
      </p>

      <section className="bg-white border rounded-lg p-5 mb-5">
        <h2 className="text-sm font-bold mb-3 text-gray-700">プロフィール</h2>
        <AccountForm
          initialDisplayName={profile?.display_name ?? "ユーザー"}
        />
      </section>

      <section className="bg-white border rounded-lg p-5 mb-5">
        <h2 className="text-sm font-bold mb-3 text-gray-700">プラン</h2>
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded font-mono">
              {profile?.plan ?? "free"}
            </span>
            <p className="text-xs text-gray-500 mt-2">
              Pro / Premium プランは準備中です。
              提供開始時にここから切替できるようになります。
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white border rounded-lg p-5">
        <h2 className="text-sm font-bold mb-3 text-gray-700">ログアウト</h2>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-900"
          >
            ログアウト
          </button>
        </form>
      </section>
    </div>
  );
}
