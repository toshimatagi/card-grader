import type { Metadata } from "next";
import "./globals.css";
import GoogleAnalytics from "../components/GoogleAnalytics";
import AdSense from "../components/AdSense";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";
const SITE_NAME = "TCG Authority - ワンピカード鑑定 & 価格DB";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: "%s | TCG Authority",
  },
  description:
    "ワンピースカードゲームの自動鑑定 (PSA/BGS基準) + 全カード価格DB。中央値ベースの相場と裁断・センタリング・表面・色印刷の4項目スコアを無料で確認。",
  keywords: [
    "ワンピースカード", "ワンピカード", "ONE PIECE TCG",
    "カード鑑定", "PSA鑑定", "BGS鑑定", "センタリング",
    "カード相場", "ワンピカード価格", "高額カード",
  ],
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description:
      "写真1枚でカードの状態をPSA/BGS基準で自動鑑定。ワンピカード3000枚以上の最新価格相場も無料で閲覧。",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "写真1枚でカードの状態をPSA/BGS基準で自動鑑定。ワンピカード3000枚以上の最新価格相場も無料で閲覧。",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <AdSense />
      </head>
      <GoogleAnalytics />
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
              <a href="/trending" className="hover:text-blue-400 transition-colors">
                値上がり
              </a>
              <a href="/guide" className="hover:text-blue-400 transition-colors">
                使い方
              </a>
            </div>
          </nav>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
