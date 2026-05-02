import type { Metadata } from "next";
import "./globals.css";
import GoogleAnalytics from "../components/GoogleAnalytics";
import AdSense from "../components/AdSense";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";
const SITE_NAME = "TCG Authority - ワンピカード型番・相場・状態チェック";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: "%s | TCG Authority",
  },
  description:
    "ワンピカードの型番・相場・値上がりをまとめてチェック。AIでカードを特定し価格DBと照合。フリマ購入前・仕入れ判断・PSA提出前の確認に使える無料ツール。",
  keywords: [
    "ワンピースカード", "ワンピカード", "ONE PIECE TCG",
    "カード相場", "ワンピカード価格", "高額カード",
    "カード型番", "カード状態チェック", "フリマ購入前", "仕入れ",
    "値上がり", "値上がりランキング", "センタリング",
  ],
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description:
      "AIでカードを特定し価格DBと照合。表裏画像から状態リスクをチェック。フリマ購入前・仕入れ判断・PSA提出前の確認に。",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "AIでカードを特定し価格DBと照合。表裏画像から状態リスクをチェック。フリマ購入前・仕入れ判断・PSA提出前の確認に。",
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
