/**
 * PSA10/9/8 当選確率の推定と提出時の損益シミュレーション。
 *
 * AI鑑定の overall_grade (0-10) から、PSA に出した時の各等級
 * 当選確率を返す。実データでのキャリブレーションは未実施 (Phase 3.5 で予定)、
 * 現状は経験則ベースのテーブル参照。
 *
 * 重要: これは推定値であり、実際の鑑定結果を保証するものではない。
 * UI 側で必ず「推定値です」の注意書きを併記すること。
 */

export type GradeProbabilities = {
  psa10: number;
  psa9: number;
  psa8: number;
  below_psa8: number; // PSA7 以下 (鑑定価値ほぼなし)
};

/** PSA 鑑定の実費 (日本標準コース。1枚あたり) */
export const PSA_COST = {
  fee: 3800,          // 鑑定料金 (PSA Japan 標準コース、~5万円カード)
  shipping: 1000,     // 送料・返送料の概算
  get total() {
    return this.fee + this.shipping;
  },
};

/**
 * overall_grade (0-10) + confidence (0-1) から PSA 当選確率分布を返す。
 * 低 confidence 時は分布を均し気味にする (= 「自信なし」を反映)。
 */
export function estimateGradeProbabilities(
  overallGrade: number,
  confidence: number = 1.0,
): GradeProbabilities {
  let dist: GradeProbabilities;
  if (overallGrade >= 9.7) {
    dist = { psa10: 0.78, psa9: 0.17, psa8: 0.04, below_psa8: 0.01 };
  } else if (overallGrade >= 9.5) {
    dist = { psa10: 0.55, psa9: 0.30, psa8: 0.10, below_psa8: 0.05 };
  } else if (overallGrade >= 9.0) {
    dist = { psa10: 0.30, psa9: 0.35, psa8: 0.20, below_psa8: 0.15 };
  } else if (overallGrade >= 8.5) {
    dist = { psa10: 0.12, psa9: 0.28, psa8: 0.30, below_psa8: 0.30 };
  } else if (overallGrade >= 8.0) {
    dist = { psa10: 0.04, psa9: 0.18, psa8: 0.32, below_psa8: 0.46 };
  } else if (overallGrade >= 7.5) {
    dist = { psa10: 0.01, psa9: 0.08, psa8: 0.26, below_psa8: 0.65 };
  } else {
    dist = { psa10: 0.005, psa9: 0.03, psa8: 0.12, below_psa8: 0.845 };
  }

  // confidence 低い時 = 撮影条件悪い → 分布を均す
  if (confidence < 0.7) {
    const k = 0.3;
    const u = 0.25;
    dist = {
      psa10:      dist.psa10      * (1 - k) + u * k,
      psa9:       dist.psa9       * (1 - k) + u * k,
      psa8:       dist.psa8       * (1 - k) + u * k,
      below_psa8: dist.below_psa8 * (1 - k) + u * k,
    };
  }
  return dist;
}

/**
 * 期待売却価格 (鑑定費・送料控除前)。
 * 価格データのある grade だけを採用し、確率を再正規化して重み付き平均を返す。
 * すべて null なら null を返す。
 */
export function expectedSalePrice(
  probs: GradeProbabilities,
  prices: {
    psa10: number | null;
    psa9: number | null;
    psa8: number | null;
    raw: number | null;
  },
): number | null {
  const components: Array<[number, number]> = [];
  if (prices.psa10 != null) components.push([probs.psa10, prices.psa10]);
  if (prices.psa9  != null) components.push([probs.psa9,  prices.psa9]);
  if (prices.psa8  != null) components.push([probs.psa8,  prices.psa8]);
  // PSA7 以下は無鑑定相当 → Raw 価格として扱う (鑑定費は別途控除)
  if (prices.raw   != null) components.push([probs.below_psa8, prices.raw]);

  if (components.length === 0) return null;
  const totalProb = components.reduce((s, [p]) => s + p, 0);
  if (totalProb <= 0) return null;
  return Math.round(
    components.reduce((s, [p, v]) => s + (p / totalProb) * v, 0),
  );
}

/**
 * 提出 → 売却の総合ROI。
 *   購入価格 (rawPrice) で買って PSA に出し、期待値で売った時の損益。
 */
export function expectedROI(
  probs: GradeProbabilities,
  prices: {
    psa10: number | null;
    psa9: number | null;
    psa8: number | null;
    raw: number | null;
  },
  purchasePrice: number,
  gradingCost: number = PSA_COST.total,
): {
  expectedSale: number | null;
  expectedProfit: number | null;
  breakEvenSale: number;
  roiPct: number | null;
} {
  const sale = expectedSalePrice(probs, prices);
  const breakEven = purchasePrice + gradingCost;
  if (sale == null) {
    return { expectedSale: null, expectedProfit: null, breakEvenSale: breakEven, roiPct: null };
  }
  const profit = sale - breakEven;
  const totalCost = purchasePrice + gradingCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : null;
  return {
    expectedSale: sale,
    expectedProfit: profit,
    breakEvenSale: breakEven,
    roiPct: roi,
  };
}

export const PROB_LABELS = {
  psa10: "PSA 10",
  psa9: "PSA 9",
  psa8: "PSA 8",
  below_psa8: "PSA 7以下",
} as const;
