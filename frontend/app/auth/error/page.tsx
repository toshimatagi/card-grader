import Link from "next/link";

export const metadata = {
  title: "ログインエラー",
  robots: { index: false, follow: false },
};

export default function AuthErrorPage() {
  return (
    <div className="max-w-md mx-auto py-12 text-center">
      <h1 className="text-2xl font-bold mb-4">ログインに失敗しました</h1>
      <p className="text-sm text-gray-600 mb-6">
        ブラウザの戻るボタンで前のページに戻り、もう一度お試しください。
        問題が続く場合はブラウザの Cookie をクリアしてからお試しください。
      </p>
      <Link
        href="/"
        className="inline-block px-5 py-2 bg-gray-900 text-white rounded hover:bg-gray-700 text-sm"
      >
        トップへ戻る
      </Link>
    </div>
  );
}
