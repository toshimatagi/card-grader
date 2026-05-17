import Script from "next/script";

/**
 * GA4 を window.load 後 (= idle 時) にロードする。
 *
 * 元は strategy="afterInteractive" (hydration 直後) で、LCP / TBT を圧迫していた。
 * lazyOnload に変更することで:
 *   - First Paint と LCP を阻害しない
 *   - 計測自体は数百ms 遅れるが、初回 PV カウントは確実 (window load より後)
 *   - 短時間離脱ユーザーの計測漏れは多少あるが、SEO/LCP優先
 *
 * 注: AdSense (components/AdSense.tsx) は AdSense bot 検出のため
 * 生 script tag のまま <head> に残す方針 (memory: nextjs_script_crawler_visibility)。
 */
export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="lazyOnload"
      />
      <Script id="ga-init" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
