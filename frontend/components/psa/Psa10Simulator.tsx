"use client";

/**
 * PSA10提出 損益シミュレーター (カード詳細ページ用)
 *
 * ユーザーが「状態見立て」と「購入価格」を変えながら、PSA10 提出した時の
 * 期待利益・損益分岐点を確認できる。AI鑑定をやってないカード (= 価格DB
 * を眺めているだけ) でも仕入れ判断に使えるよう、状態 dropdown 方式。
 */
import { useState } from "react";
import {
  estimateGradeProbabilities,
  expectedROI,
  PSA_COST,
  PROB_LABELS,
} from "../../lib/psaProbability";

const CONDITION_PRESETS = [
  { value: 9.8, label: "完美品 (角・エッジ無傷、センタリング◎)", chance: "PSA10 当選率高" },
  { value: 9.5, label: "美品 (細かい白かけ無し、軽微なエッジ)", chance: "PSA10 期待大" },
  { value: 9.0, label: "良品 (近距離で見ると微少傷あり)", chance: "PSA9 がメイン" },
  { value: 8.5, label: "並品 (角の白かけ・小傷あり)", chance: "PSA8-9 想定" },
  { value: 8.0, label: "傷あり品 (目視で傷分かる)", chance: "PSA7-8 が多い" },
];

export default function Psa10Simulator({
  cardName,
  prices,
}: {
  cardName: string;
  prices: {
    psa10: number | null;
    psa9: number | null;
    psa8: number | null;
    raw: number | null;
  };
}) {
  const [overallScore, setOverallScore] = useState(9.5);
  const [purchasePrice, setPurchasePrice] = useState<number>(
    prices.raw ?? 1000,
  );

  const probs = estimateGradeProbabilities(overallScore, 1.0);
  const roi = expectedROI(probs, prices, purchasePrice, PSA_COST.total);

  const hasAnyPsaPrice =
    prices.psa10 != null || prices.psa9 != null || prices.psa8 != null;

  if (!hasAnyPsaPrice) {
    return (
      <section className="mb-8 p-4 rounded-lg border border-purple-200 bg-purple-50">
        <h2 className="font-bold mb-2 text-purple-900">
          🎯 PSA10 提出損益シミュレーター
        </h2>
        <p className="text-xs text-purple-800 leading-relaxed">
          このカードの PSA価格データはまだ収集中です。
          データが揃い次第シミュレーターが表示されます。
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8 p-4 rounded-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
      <h2 className="font-bold mb-1 text-purple-900">
        🎯 PSA10 提出 損益シミュレーター
      </h2>
      <p className="text-[11px] text-purple-700 mb-4">
        「{cardName}」を購入して PSA に出した場合の期待利益を確率ベースで試算します。
      </p>

      {/* 入力: 状態見立て */}
      <div className="space-y-3 mb-4">
        <label className="block">
          <span className="text-xs font-bold text-purple-900">
            想定するカード状態 (AI鑑定スコア相当)
          </span>
          <select
            value={overallScore}
            onChange={(e) => setOverallScore(parseFloat(e.target.value))}
            className="mt-1 w-full border rounded px-2 py-2 text-sm bg-white"
          >
            {CONDITION_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label} → {p.chance}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold text-purple-900">
            購入価格 (¥)
          </span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(Math.max(0, parseInt(e.target.value) || 0))}
              step={100}
              min={0}
              className="flex-1 border rounded px-2 py-2 text-sm bg-white tabular-nums"
            />
            {prices.raw != null && (
              <button
                type="button"
                onClick={() => setPurchasePrice(prices.raw!)}
                className="text-[11px] text-purple-700 hover:underline whitespace-nowrap"
              >
                Raw中央値 ¥{prices.raw.toLocaleString()} を使う
              </button>
            )}
          </div>
        </label>
      </div>

      {/* 確率分布 */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        {(["psa10", "psa9", "psa8", "below_psa8"] as const).map((g) => {
          const p = probs[g];
          const pct = Math.round(p * 100);
          const isTop = p === Math.max(...Object.values(probs));
          return (
            <div
              key={g}
              className={`text-center rounded p-2 ${
                isTop
                  ? "bg-purple-200 ring-2 ring-purple-500"
                  : "bg-white border border-purple-100"
              }`}
            >
              <div className="text-[10px] font-bold text-purple-900">
                {PROB_LABELS[g]}
              </div>
              <div
                className={`text-lg font-extrabold tabular-nums ${
                  isTop ? "text-purple-900" : "text-gray-600"
                }`}
              >
                {pct}%
              </div>
            </div>
          );
        })}
      </div>

      {/* 損益サマリ */}
      {roi.expectedSale != null && (
        <div className="rounded bg-white border border-purple-200 p-3 text-sm space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-gray-600">期待売却価格 (確率加重)</span>
            <strong className="text-lg text-purple-900 tabular-nums">
              ¥{roi.expectedSale.toLocaleString()}
            </strong>
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>− 購入価格</span>
            <span className="tabular-nums">¥{purchasePrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>− 鑑定費用 (PSA日本標準 + 送料)</span>
            <span className="tabular-nums">¥{PSA_COST.total.toLocaleString()}</span>
          </div>
          <div
            className={`flex justify-between items-baseline pt-1 border-t ${
              roi.expectedProfit! >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            <span className="text-xs font-bold">期待利益</span>
            <strong className="text-base tabular-nums">
              {roi.expectedProfit! >= 0 ? "+" : "−"}¥
              {Math.abs(roi.expectedProfit!).toLocaleString()}
              {roi.roiPct != null && (
                <span className="text-xs ml-1">
                  ({roi.roiPct >= 0 ? "+" : ""}
                  {roi.roiPct.toFixed(0)}%)
                </span>
              )}
            </strong>
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 pt-1">
            <span>損益分岐点 (期待売価がこれを上回れば黒字)</span>
            <span className="tabular-nums">
              ¥{roi.breakEvenSale.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      <p className="mt-2 text-[10px] text-purple-700 leading-relaxed">
        ※ 当選確率は AI鑑定スコアの経験則ベース、実 PSA 判定を保証しません。
        鑑定費用は PSA日本標準コース (~¥3,800) + 送料 (~¥1,000) で試算。
        急ぎコースや海外送付の場合は変動します。
      </p>
    </section>
  );
}
