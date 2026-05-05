import type { Metadata } from "next";
import "./globals.css";
import GoogleAnalytics from "../components/GoogleAnalytics";
import AdSense from "../components/AdSense";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tcg-authority.com";
const SITE_NAME = "TCG Authority - ワンピカード・ポケカの型番・相場・状態チェック";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: "%s | TCG Authority",
  },
  description:
    "ワンピカード・ポケカの型番・相場・値上がりをまとめてチェック。AIでカードを特定し価格DBと照合。フリマ購入前・仕入れ判断・PSA提出前の確認に使える無料ツール。",
  keywords: [
    "ワンピースカード", "ワンピカード", "ONE PIECE TCG",
    "ポケモンカード", "ポケカ", "ポケモンTCG",
    "カード相場", "カード価格DB", "高額カード",
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
      "AIでカードを特定し価格DBと照合。表裏画像から状態リスクをチェック。ワンピカード・ポケカ対応。",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "AIでカードを特定し価格DBと照合。表裏画像から状態リスクをチェック。ワンピカード・ポケカ対応。",
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
              TCG Authority
              <span className="text-xs font-normal text-gray-400 ml-2 hidden sm:inline">
                ワンピ・ポケカ価格DB & 鑑定
              </span>
            </a>
            <div className="flex gap-5 text-sm items-center">
              <a href="/" className="hover:text-blue-400 transition-colors">
                鑑定
              </a>
              <details className="relative group [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer hover:text-blue-400 transition-colors list-none flex items-center gap-1">
                  価格DB
                  <span className="text-[10px] text-gray-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="absolute left-0 mt-2 w-44 rounded-md bg-gray-800 border border-gray-700 shadow-lg z-50 py-1">
                  <a href="/cards" className="block px-3 py-2 text-sm hover:bg-gray-700">
                    <div>すべて見る</div>
                    <div className="text-[10px] text-gray-400">ワンピ・ポケカ概要</div>
                  </a>
                  <a href="/cards/onepiece" className="block px-3 py-2 text-sm hover:bg-gray-700">
                    <div>ワンピカード</div>
                    <div className="text-[10px] text-gray-400">OP / ST / EB / PRB</div>
                  </a>
                  <a href="/cards/pokemon" className="block px-3 py-2 text-sm hover:bg-gray-700">
                    <div>ポケモンカード</div>
                    <div className="text-[10px] text-gray-400">M / SV / SM / S</div>
                  </a>
                </div>
              </details>
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
