import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Grader - TCG鑑定士",
  description: "トレーディングカードの状態を自動鑑定するアプリケーション",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <header className="bg-gray-900 text-white">
          <nav className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-bold tracking-tight">
              Card Grader
              <span className="text-sm font-normal text-gray-400 ml-2">TCG鑑定士</span>
            </a>
            <div className="flex gap-6 text-sm">
              <a href="/" className="hover:text-blue-400 transition-colors">
                鑑定する
              </a>
              <a href="/history" className="hover:text-blue-400 transition-colors">
                履歴
              </a>
              <a href="/cards" className="hover:text-blue-400 transition-colors">
                価格DB
              </a>
              <a href="/guide" className="hover:text-blue-400 transition-colors">
                使い方
              </a>
              <a href="/spec" className="hover:text-blue-400 transition-colors">
                仕様書
              </a>
            </div>
          </nav>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
