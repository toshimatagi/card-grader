import type { Metadata } from "next";
import "./globals.css";
import GoogleAnalytics from "../components/GoogleAnalytics";
import AdSense from "../components/AdSense";
import HeaderAuth from "../components/auth/HeaderAuth";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Vercel Hobby plan は iad1 (US East) 固定のため preferredRegion は効かない。
// Pro upgrade 後に "bom1" 等を指定して Supabase (ap-south-1) に近づける。
// 現状は sbGet の Next.js Data Cache (revalidate=60) で DB 往復を削減して対処。

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

const AUTH_ENABLED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <AdSense />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}#website`,
                  url: SITE_URL,
                  name: "TCG Authority",
                  description:
                    "ワンピカード・ポケカの型番・相場・PSA10倍率・AI鑑定をまとめて確認できる無料ツール",
                  inLanguage: "ja-JP",
                  publisher: { "@id": `${SITE_URL}#organization` },
                  potentialAction: {
                    "@type": "SearchAction",
                    target: {
                      "@type": "EntryPoint",
                      urlTemplate: `${SITE_URL}/cards?q={search_term_string}`,
                    },
                    "query-input": "required name=search_term_string",
                  },
                },
                {
                  "@type": "Organization",
                  "@id": `${SITE_URL}#organization`,
                  name: "TCG Authority",
                  url: SITE_URL,
                  logo: {
                    "@type": "ImageObject",
                    url: `${SITE_URL}/icon.png`,
                  },
                },
              ],
            }),
          }}
        />
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
              {AUTH_ENABLED && <HeaderAuth />}
            </div>
          </nav>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        <SiteFooter />
        {/* Vercel 計測。Analytics = PV/イベント、SpeedInsights = Web Vitals (LCP/INP/CLS) */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

/**
 * SEO リッチフッター。クローラーが各カテゴリへ辿れるよう、
 * 主要ランキング・ブランド・セット (人気順) ・ガイド記事への
 * テキストリンクを大量に張る。
 */
function SiteFooter() {
  // 主要ポケカ弾 (新しい順、過去2年範囲)
  const popularPokemon = [
    "M04", "M03", "M02A", "M02", "M01L", "M01S",
    "SV11W", "SV11B", "SV10", "SV9A", "SV9",
    "SV8B", "SV8A", "SV8", "SV7P", "SV7A", "SV7", "SV6A", "SV6",
  ];
  const popularOnepiece = [
    "OP15", "OP14", "OP13", "OP12", "OP11", "OP10",
    "EB04", "EB03", "EB02", "PRB02", "PRB01",
    "ST30", "ST29", "ST22",
  ];

  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs">
          <div>
            <h3 className="font-bold text-white mb-3 text-sm">価格DB</h3>
            <ul className="space-y-1.5">
              <li><a href="/cards" className="hover:text-blue-300">価格DB トップ</a></li>
              <li><a href="/cards/onepiece" className="hover:text-blue-300">ワンピカード DB</a></li>
              <li><a href="/cards/pokemon" className="hover:text-blue-300">ポケモンカード DB</a></li>
              <li><a href="/trending" className="hover:text-blue-300">値上がりランキング</a></li>
              <li><a href="/trending/psa10" className="hover:text-blue-300">PSA10 高額TOP</a></li>
              <li><a href="/trending/spread" className="hover:text-blue-300">Raw→PSA10 倍率TOP</a></li>
              <li><a href="/trending/raw" className="hover:text-blue-300">Raw 高額TOP</a></li>
              <li><a href="/weekly" className="hover:text-blue-300">週次 値上がりレポート</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-white mb-3 text-sm">ポケカ 主要弾</h3>
            <ul className="space-y-1.5">
              {popularPokemon.map((s) => (
                <li key={s}>
                  <a href={`/cards/pokemon/${s}`} className="hover:text-yellow-300 font-mono">
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-white mb-3 text-sm">ワンピ 主要弾</h3>
            <ul className="space-y-1.5">
              {popularOnepiece.map((s) => (
                <li key={s}>
                  <a href={`/cards/onepiece/${s}`} className="hover:text-orange-300 font-mono">
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-white mb-3 text-sm">ガイド・ツール</h3>
            <ul className="space-y-1.5">
              <li><a href="/" className="hover:text-blue-300">AI鑑定 (表裏チェック)</a></li>
              <li><a href="/guide" className="hover:text-blue-300">使い方ガイド</a></li>
              <li><a href="/guide/psa10-tousenritu" className="hover:text-blue-300">PSA10 取得率ガイド</a></li>
              <li><a href="/guide/kantei-teisyutsu" className="hover:text-blue-300">鑑定提出マニュアル</a></li>
              <li><a href="/guide/mercari-takaku-uru" className="hover:text-blue-300">メルカリ高額売却術</a></li>
              <li><a href="/history" className="hover:text-blue-300">鑑定履歴</a></li>
            </ul>
            <h3 className="font-bold text-white mt-5 mb-3 text-sm">用途</h3>
            <ul className="space-y-1.5 text-gray-400">
              <li>フリマ購入前のチェック</li>
              <li>PSA / BGS 提出前のセルフ鑑定</li>
              <li>カード仕入れ判断・利幅計算</li>
              <li>コレクション資産価値把握</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[11px] text-gray-500">
          <div>
            © TCG Authority — ワンピカード・ポケカの相場と AI 鑑定。
            ポケットモンスター・ポケモン・Pokémon は任天堂・クリーチャーズ・ゲームフリークの商標です。
            ONE PIECE および関連標章はバンダイ／集英社の商標です。本サイトは公式サイトではありません。
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/about" className="hover:text-gray-300">サイトについて</a>
            <a href="/privacy" className="hover:text-gray-300">プライバシー</a>
            <a href="/terms" className="hover:text-gray-300">利用規約</a>
            <a href="/contact" className="hover:text-gray-300">お問い合わせ</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
