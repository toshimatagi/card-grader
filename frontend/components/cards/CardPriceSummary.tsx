"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CardByCodeResult, PriceConfidence } from "../../lib/api";

interface Props {
  code: string;
}

const VARIANT_LABEL: Record<string, string> = {
  normal: "通常",
  parallel: "パラレル",
  super_parallel: "スーパーパラレル",
  alt_art: "アルトアート",
  manga: "マンガ",
  other: "その他",
};

const CONFIDENCE_META: Record<PriceConfidence, { label: string; cls: string }> = {
  high: { label: "高", cls: "bg-green-100 text-green-700 border-green-200" },
  medium: { label: "中", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  low: { label: "低", cls: "bg-gray-100 text-gray-600 border-gray-200" },
};

export default function CardPriceSummary({ code }: Props) {
  const [data, setData] = useState<CardByCodeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    setError(null);
    fetch(`/api/cards/${encodeURIComponent(code)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("価格情報が見つかりません");
        return r.json();
      })
      .then((d) => {
        if (!abort) setData(d);
      })
      .catch((e) => {
        if (!abort) setError(e instanceof Error ? e.message : "取得失敗");
      })
      .finally(() => {
        if (!abort) setLoading(false);
      });
    return () => {
      abort = true;
    };
  }, [code]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="text-sm text-gray-500">価格情報を取得中...</div>
      </div>
    );
  }

  if (error || !data || data.cards.length === 0) {
    return null;
  }

  const first = data.cards[0];
  const anySell = data.cards.some((c) => c.sell_price != null);
  const anyBuy = data.cards.some((c) => c.buy_price != null);
  if (!anySell && !anyBuy) return null;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          このカードの相場
          <span className="text-sm font-normal text-gray-500 ml-2">{data.code}</span>
        </h2>
        <Link
          href={`/cards/${data.code}`}
          className="text-sm text-blue-600 hover:underline whitespace-nowrap"
        >
          詳細・推移を見る →
        </Link>
      </div>
      <div className="flex gap-4">
        {first.image_url && (
          <img
            src={first.image_url}
            alt={first.name_ja}
            className="w-24 h-auto rounded flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold mb-2 truncate">{first.name_ja}</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1 pr-2">バリアント</th>
                <th className="py-1 px-2 text-right">販売</th>
                <th className="py-1 px-2 text-right">買取</th>
                <th className="py-1 pl-2 text-right">買取率</th>
              </tr>
            </thead>
            <tbody>
              {data.cards.map((c) => {
                const buyRate =
                  c.sell_stats && c.buy_stats && c.sell_stats.median > 0
                    ? Math.round((c.buy_stats.median / c.sell_stats.median) * 100)
                    : null;
                return (
                  <tr key={c.id} className="border-t">
                    <td className="py-1 pr-2 text-xs">
                      {VARIANT_LABEL[c.variant] ?? c.variant} / {c.rarity}
                    </td>
                    <td className="py-1 px-2 text-right tabular-nums">
                      {c.sell_price != null
                        ? `¥${c.sell_price.toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="py-1 px-2 text-right tabular-nums">
                      {c.buy_price != null
                        ? `¥${c.buy_price.toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="py-1 pl-2 text-right tabular-nums text-xs">
                      {buyRate != null ? `${buyRate}%` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* 信頼度行 (販売データがある最初のバリアントを採用) */}
          {(() => {
            const sellStats = data.cards.find((c) => c.sell_stats)?.sell_stats;
            if (!sellStats) return null;
            return (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-600">
                <span>信頼度:</span>
                <span
                  className={`inline-block px-1.5 py-0.5 rounded-full font-medium border ${
                    CONFIDENCE_META[sellStats.confidence].cls
                  }`}
                >
                  {CONFIDENCE_META[sellStats.confidence].label}
                </span>
                <span>{sellStats.sourceCount}サイト</span>
                <span>{sellStats.sampleCount}件</span>
                {sellStats.min !== sellStats.max && (
                  <span>
                    幅 ¥{sellStats.min.toLocaleString()}〜¥
                    {sellStats.max.toLocaleString()}
                  </span>
                )}
              </div>
            );
          })()}

          <p className="text-xs text-gray-500 mt-2">
            ※ 複数の取扱いサイトから集計した中央値
          </p>
        </div>
      </div>
    </div>
  );
}
