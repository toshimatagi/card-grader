"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CardByCodeResult, CardGradePrice, PriceConfidence } from "../../lib/api";
import { GRADE_LABEL, GRADE_DISPLAY_ORDER } from "../../lib/api";

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

      {/* グレード別相場 + PSA10 利益計算 */}
      <GradePriceSection gradePrices={data.gradePrices} rawSellPrice={data.cards[0]?.sell_price ?? null} />
    </div>
  );
}

function GradePriceSection({
  gradePrices,
  rawSellPrice,
}: {
  gradePrices: CardGradePrice[];
  rawSellPrice: number | null;
}) {
  if (gradePrices.length === 0) return null;

  const byGrade = new Map<string, CardGradePrice>();
  for (const g of gradePrices) {
    if (!byGrade.has(g.grade) || (g.price_median ?? 0) > 0) {
      byGrade.set(g.grade, g);
    }
  }

  const displayGrades = GRADE_DISPLAY_ORDER.filter((g) => byGrade.has(g));
  if (displayGrades.length === 0) return null;

  const psa10 = byGrade.get("psa10");
  const profit =
    psa10?.price_median && rawSellPrice
      ? psa10.price_median - rawSellPrice
      : null;

  return (
    <div className="mt-5 pt-4 border-t">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">グレード別相場</h3>
        <span className="text-[11px] text-gray-400">eBay / メルカリ 成約中央値</span>
      </div>

      {/* PSA10 利益バナー */}
      {profit !== null && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2 ${
          profit > 0
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-gray-50 text-gray-600 border border-gray-200"
        }`}>
          <span>{profit > 0 ? "📈" : "📊"}</span>
          <span>
            PSA10 にすると Raw より
            {profit > 0
              ? ` +¥${profit.toLocaleString()} の上乗せ相場`
              : ` ¥${Math.abs(profit).toLocaleString()} 差`}
          </span>
          {profit > 0 && rawSellPrice && (
            <span className="text-[11px] font-normal text-green-600">
              ({Math.round((profit / rawSellPrice) * 100)}% 増)
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {displayGrades.map((grade) => {
          const g = byGrade.get(grade)!;
          return (
            <div key={grade} className="flex-1 min-w-[100px] bg-gray-50 rounded-lg p-2 text-center border">
              <div className="text-[10px] text-gray-500 mb-0.5 truncate">{GRADE_LABEL[grade]}</div>
              <div className="text-sm font-bold tabular-nums">
                {g.price_median != null
                  ? `¥${g.price_median.toLocaleString()}`
                  : "-"}
              </div>
              {g.sample_count > 0 && (
                <div className="text-[10px] text-gray-400">{g.sample_count}件</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
