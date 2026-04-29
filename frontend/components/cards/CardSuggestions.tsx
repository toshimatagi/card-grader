"use client";

import type { CardSuggestion } from "../../lib/api";

interface Props {
  candidates: CardSuggestion[];
  selectedCardId: string | null;
  onSelect: (c: CardSuggestion | null) => void;
  loading: boolean;
}

const VARIANT_LABEL: Record<string, string> = {
  normal: "通常",
  parallel: "パラレル",
  super_parallel: "スーパーパラレル",
  alt_art: "アルトアート",
  manga: "マンガ",
  other: "その他",
};

export default function CardSuggestions({
  candidates,
  selectedCardId,
  onSelect,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="border rounded-lg p-3 bg-gray-50">
        <div className="text-xs text-gray-500 mb-2">候補カードを検索中...</div>
        <div className="flex gap-2 overflow-x-auto">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-24 h-32 bg-gray-200 rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-lg p-3 bg-blue-50 border-blue-200">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">
          このカードですか？
          <span className="text-xs text-gray-500 ml-2">
            画像から候補を検出しました
          </span>
        </div>
        {selectedCardId && (
          <button
            onClick={() => onSelect(null)}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            選択を解除
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {candidates.map((c) => {
          const code = `${c.set_code}-${c.card_no}`;
          const selected = c.card_id === selectedCardId;
          return (
            <button
              key={c.card_id}
              onClick={() => onSelect(c)}
              className={`flex-shrink-0 w-28 text-left rounded-lg border-2 p-1.5 transition-colors ${
                selected
                  ? "border-blue-600 bg-white"
                  : "border-transparent bg-white hover:border-blue-300"
              }`}
            >
              {c.image_url ? (
                <img
                  src={c.image_url}
                  alt={c.name_ja}
                  className="w-full h-auto rounded"
                  loading="lazy"
                />
              ) : (
                <div className="w-full aspect-[5/7] bg-gray-200 rounded" />
              )}
              <div className="mt-1 text-[10px] text-gray-500">{code}</div>
              <div className="text-xs font-bold truncate" title={c.name_ja}>
                {c.name_ja}
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                {VARIANT_LABEL[c.variant] ?? c.variant} · {c.rarity}
                <span className="ml-1 text-gray-400">({c.distance})</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
