"use client";

import { useState } from "react";

type Props = {
  /** シェアする URL — 省略時は現在のページ URL */
  url?: string;
  /** シェア時の固定テキスト */
  text: string;
  /** 表示位置を調整するための追加 className */
  className?: string;
  /** Compact モード (横一列・小さめ) */
  compact?: boolean;
};

const SITE_URL = "https://tcg-authority.com";

export default function ShareButtons({
  url,
  text,
  className = "",
  compact = false,
}: Props) {
  const [copied, setCopied] = useState(false);

  const shareUrl = (() => {
    if (typeof window === "undefined") return url ?? SITE_URL;
    return url ?? window.location.href;
  })();

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(text);

  // Twitter (X)
  const xHref = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}&hashtags=TCGAuthority`;
  // LINE
  const lineHref = `https://social-plugins.line.me/lineit/share?url=${encodedUrl}&text=${encodedText}`;
  // Hatena Bookmark
  const hatenaHref = `https://b.hatena.ne.jp/entry/${shareUrl.replace(/^https?:\/\//, "")}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const btnBase = compact
    ? "inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border bg-white hover:bg-gray-50 transition-colors"
    : "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border bg-white hover:bg-gray-50 transition-colors font-medium";

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      role="group"
      aria-label="ソーシャルシェア"
    >
      {!compact && (
        <span className="text-xs text-gray-500 mr-1">シェア:</span>
      )}
      <a
        href={xHref}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={`${btnBase} border-gray-300 text-gray-800 hover:bg-gray-50`}
        aria-label="X (Twitter) でシェア"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        X
      </a>
      <a
        href={lineHref}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={`${btnBase} border-green-300 text-green-700 hover:bg-green-50`}
        aria-label="LINE でシェア"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2C6.477 2 2 5.65 2 10.158c0 4.04 3.553 7.42 8.347 8.05.325.07.768.215.88.494.1.252.066.647.032.9 0 0-.117.703-.142.852-.044.252-.2.987.866.539 1.066-.448 5.747-3.385 7.84-5.794 1.443-1.585 2.13-3.196 2.13-4.99C21.953 5.65 17.477 2 12 2zM7.857 12.42h-2.55a.27.27 0 0 1-.27-.27V7.2a.27.27 0 0 1 .27-.27h.84a.27.27 0 0 1 .27.27v3.93h1.44a.27.27 0 0 1 .27.27v.75a.27.27 0 0 1-.27.27zm2.07 0h-.84a.27.27 0 0 1-.27-.27V7.2a.27.27 0 0 1 .27-.27h.84a.27.27 0 0 1 .27.27v4.95a.27.27 0 0 1-.27.27zm5.49 0h-.84a.27.27 0 0 1-.215-.108L11.92 9.054v3.097a.27.27 0 0 1-.27.27h-.84a.27.27 0 0 1-.27-.27V7.2a.27.27 0 0 1 .27-.27h.84c.085 0 .163.04.215.108l2.442 3.258V7.2a.27.27 0 0 1 .27-.27h.84a.27.27 0 0 1 .27.27v4.95a.27.27 0 0 1-.27.27zm3.86 0h-2.55a.27.27 0 0 1-.27-.27V7.2a.27.27 0 0 1 .27-.27h2.55a.27.27 0 0 1 .27.27v.75a.27.27 0 0 1-.27.27h-1.44v.555h1.44a.27.27 0 0 1 .27.27v.75a.27.27 0 0 1-.27.27h-1.44v.555h1.44a.27.27 0 0 1 .27.27v.75a.27.27 0 0 1-.27.27z" />
        </svg>
        LINE
      </a>
      <a
        href={hatenaHref}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={`${btnBase} border-blue-300 text-blue-700 hover:bg-blue-50`}
        aria-label="はてなブックマークに追加"
      >
        <span className="font-bold leading-none">B!</span>
      </a>
      <button
        type="button"
        onClick={onCopy}
        className={`${btnBase} border-gray-300 text-gray-700`}
        aria-label="URL をコピー"
      >
        {copied ? (
          <>
            <span aria-hidden>✓</span>
            コピー済
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            URL コピー
          </>
        )}
      </button>
    </div>
  );
}
