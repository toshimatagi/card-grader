"use client";

import { useEffect, useRef } from "react";

const ADSENSE_CLIENT_ID = "ca-pub-5248501271307957";

interface AdUnitProps {
  slot: string;
  format?: "auto" | "fluid" | "rectangle" | "vertical" | "horizontal";
  layoutKey?: string; // インフィード広告に必要
  responsive?: boolean;
  className?: string;
}

export default function AdUnit({
  slot,
  format = "auto",
  layoutKey,
  responsive = true,
  className = "",
}: AdUnitProps) {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    const ins = insRef.current;
    if (!ins) return;
    if (ins.getAttribute("data-adsbygoogle-status") === "done") return;
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {}
  }, []);

  return (
    <div className={`text-center ${className}`}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}
