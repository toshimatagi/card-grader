/**
 * ONE PIECE カードゲーム セットマスター
 *
 * set_code は DB 上の正規化形式 (大文字、数字部分2桁ゼロ埋め)。例: 'OP15', 'EB02', 'PRB02'。
 */

export type OnePieceSetMeta = {
  name: string; // 弾の正式名 (例: "新時代の主役")
  releaseDate: string; // YYYY-MM 形式
  series: "OP" | "ST" | "EB" | "PRB"; // ブースター/スターター/エクストラブースター/プレミアムブースター
  kind: "ブースター" | "スターターデッキ" | "エクストラブースター" | "プレミアムブースター";
};

// 主要セットのみメタを保持。未登録セットは set_code をそのまま表示する。
export const ONEPIECE_SETS: Record<string, OnePieceSetMeta> = {
  // ブースター
  OP01: { name: "ROMANCE DAWN", releaseDate: "2022-12", series: "OP", kind: "ブースター" },
  OP02: { name: "頂上決戦", releaseDate: "2023-03", series: "OP", kind: "ブースター" },
  OP03: { name: "強大な敵", releaseDate: "2023-06", series: "OP", kind: "ブースター" },
  OP04: { name: "謀略の王国", releaseDate: "2023-09", series: "OP", kind: "ブースター" },
  OP05: { name: "新時代の主役", releaseDate: "2023-12", series: "OP", kind: "ブースター" },
  OP06: { name: "双璧の覇者", releaseDate: "2024-03", series: "OP", kind: "ブースター" },
  OP07: { name: "500年後の未来", releaseDate: "2024-06", series: "OP", kind: "ブースター" },
  OP08: { name: "二つの伝説", releaseDate: "2024-09", series: "OP", kind: "ブースター" },
  OP09: { name: "新たなる皇帝", releaseDate: "2024-12", series: "OP", kind: "ブースター" },
  OP10: { name: "ROYAL BLOOD", releaseDate: "2025-03", series: "OP", kind: "ブースター" },
  OP11: { name: "Flanked by Legends", releaseDate: "2025-06", series: "OP", kind: "ブースター" },
  OP12: { name: "覚醒する黒龍", releaseDate: "2025-09", series: "OP", kind: "ブースター" },
  OP13: { name: "三船長の血統", releaseDate: "2025-12", series: "OP", kind: "ブースター" },
  OP14: { name: "覇道の狼煙", releaseDate: "2026-03", series: "OP", kind: "ブースター" },
  OP15: { name: "極悪非道の海賊", releaseDate: "2026-05", series: "OP", kind: "ブースター" },

  // エクストラブースター
  EB01: { name: "MEMORIAL COLLECTION", releaseDate: "2024-03", series: "EB", kind: "エクストラブースター" },
  EB02: { name: "ANIME 25th COLLECTION", releaseDate: "2025-04", series: "EB", kind: "エクストラブースター" },
  EB03: { name: "サイドストーリーズ", releaseDate: "2025-09", series: "EB", kind: "エクストラブースター" },
  EB04: { name: "20th MEMORIAL COLLECTION", releaseDate: "2026-02", series: "EB", kind: "エクストラブースター" },

  // プレミアムブースター
  PRB01: { name: "ONE PIECE THE BEST", releaseDate: "2024-08", series: "PRB", kind: "プレミアムブースター" },
  PRB02: { name: "ONE PIECE THE BEST II", releaseDate: "2025-09", series: "PRB", kind: "プレミアムブースター" },

  // スターター抜粋 (主要なもののみ)
  ST22: { name: "海賊王の家系", releaseDate: "2025-08", series: "ST", kind: "スターターデッキ" },
  ST29: { name: "九蛇の女戦士", releaseDate: "2026-01", series: "ST", kind: "スターターデッキ" },
  ST30: { name: "白ひげ海賊団", releaseDate: "2026-04", series: "ST", kind: "スターターデッキ" },
};

export function getOnePieceSetMeta(setCode: string): OnePieceSetMeta | null {
  return ONEPIECE_SETS[setCode.toUpperCase()] ?? null;
}

export function formatOnePieceSetLabel(setCode: string): string {
  const meta = getOnePieceSetMeta(setCode);
  if (!meta) return setCode;
  return `${setCode} ${meta.name}`;
}
