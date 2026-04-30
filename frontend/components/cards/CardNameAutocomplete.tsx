"use client";

import { useEffect, useRef, useState } from "react";
import type { CardSummary } from "../../lib/api";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (card: CardSummary) => void;
  brand?: string;
  placeholder?: string;
}

const VARIANT_LABEL: Record<string, string> = {
  normal: "通常",
  parallel: "パラレル",
  super_parallel: "スーパーパラレル",
  alt_art: "アルトアート",
  manga: "マンガ",
  other: "その他",
};

// 型番として扱うのは ハイフン後 2 桁以上揃ってから（"OP09-0" などはまだ確定しない）
const CARD_CODE_RE = /([A-Za-z]{1,4}\d{1,3})-(\d{2,4})/;

export default function CardNameAutocomplete({
  value,
  onChange,
  onSelect,
  brand,
  placeholder = "例: ナミ または OP09-050",
}: Props) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const aborter = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      aborter.current?.abort();
      const ac = new AbortController();
      aborter.current = ac;
      setLoading(true);
      try {
        const codeMatch = trimmed.match(CARD_CODE_RE);
        const params = new URLSearchParams();
        if (brand) params.set("brand", brand);
        params.set("limit", "12");
        if (codeMatch) {
          params.set("set", codeMatch[1].toUpperCase());
          params.set("card_no", codeMatch[2]);
        } else {
          params.set("q", trimmed);
        }
        const res = await fetch(`/api/cards/search?${params.toString()}`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        const items: CardSummary[] = data.items || [];
        setResults(items.slice(0, 8));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value, brand]);

  const showDropdown = open && (loading || results.length > 0);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
      />
      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-80 overflow-auto">
          {loading && results.length === 0 && (
            <div className="p-3 text-xs text-gray-500">検索中...</div>
          )}
          {results.map((c) => {
            const code = `${c.set_code}-${c.card_no}`;
            return (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect?.(c);
                  setOpen(false);
                }}
                className="flex items-center gap-3 w-full p-2 hover:bg-blue-50 text-left border-b last:border-b-0"
              >
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt=""
                    className="w-10 h-auto rounded flex-shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-10 aspect-[5/7] bg-gray-200 rounded flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name_ja}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {code} · {VARIANT_LABEL[c.variant] ?? c.variant} · {c.rarity}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
