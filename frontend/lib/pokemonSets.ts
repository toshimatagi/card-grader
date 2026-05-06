/**
 * ポケモンカードゲーム セットマスター
 *
 * cardrush.media/pokemon/packs を参考に整備。set_code は DB 上の正規化形式
 * (大文字、数字部分2桁ゼロ埋め)。例: 'M04', 'M02A', 'SV6A'。
 *
 * yuyu-tei.jp/top/poc に現存するのは MEGA シリーズの最新3〜4弾のみ
 * (旧弾は遊々亭側で取扱い終了)。SV シリーズや旧MEGA系の登録は将来 fullahead や
 * 別ソース追加時に表示されるよう先行で持っている。
 */

export type PokemonSetMeta = {
  name: string;          // 弾の正式名 (例: "ニンジャスピナー")
  releaseDate: string;   // YYYY-MM 形式
  series: "MEGA" | "SV" | "S" | "SM" | "OTHER";
  kind: "拡張" | "強化拡張" | "ハイクラス" | "スペシャル" | "スターター" | "プロモ";
};

export const POKEMON_SETS: Record<string, PokemonSetMeta> = {
  // ====================================================================
  // MEGA シリーズ (2025/08-) - 現役
  // ====================================================================
  M04:  { name: "ニンジャスピナー",       releaseDate: "2026-03", series: "MEGA", kind: "拡張" },
  M03:  { name: "ムニキスゼロ",           releaseDate: "2026-01", series: "MEGA", kind: "拡張" },
  M02A: { name: "MEGAドリームex",         releaseDate: "2025-11", series: "MEGA", kind: "ハイクラス" },
  M02:  { name: "インフェルノX",          releaseDate: "2025-09", series: "MEGA", kind: "拡張" },
  M01B: { name: "メガブレイブ",           releaseDate: "2025-08", series: "MEGA", kind: "拡張" },
  M01:  { name: "メガシンフォニア",       releaseDate: "2025-08", series: "MEGA", kind: "拡張" },

  // ====================================================================
  // SV (スカーレット&バイオレット) シリーズ (2023/01 - 2025/06)
  // ====================================================================
  SV10A: { name: "ブラックボルト",        releaseDate: "2025-06", series: "SV", kind: "拡張" },
  SV10:  { name: "ホワイトフレア",        releaseDate: "2025-06", series: "SV", kind: "拡張" },
  SV9:   { name: "ロケット団の栄光",      releaseDate: "2025-04", series: "SV", kind: "拡張" },
  SV8B:  { name: "熱風のアリーナ",        releaseDate: "2025-03", series: "SV", kind: "強化拡張" },
  SV8:   { name: "バトルパートナーズ",    releaseDate: "2025-01", series: "SV", kind: "拡張" },
  SV8A:  { name: "テラスタルフェスex",    releaseDate: "2024-12", series: "SV", kind: "ハイクラス" },
  SV7P:  { name: "超電ブレイカー",        releaseDate: "2024-10", series: "SV", kind: "拡張" },
  SV7A:  { name: "楽園ドラゴーナ",        releaseDate: "2024-09", series: "SV", kind: "強化拡張" },
  SV7:   { name: "ステラミラクル",        releaseDate: "2024-07", series: "SV", kind: "拡張" },
  SV6A:  { name: "ナイトワンダラー",      releaseDate: "2024-06", series: "SV", kind: "強化拡張" },
  SV6:   { name: "変幻の仮面",            releaseDate: "2024-04", series: "SV", kind: "拡張" },
  SV5A:  { name: "クリムゾンヘイズ",      releaseDate: "2024-03", series: "SV", kind: "強化拡張" },
  SV5M:  { name: "サイバージャッジ",      releaseDate: "2024-01", series: "SV", kind: "拡張" },
  SV5K:  { name: "ワイルドフォース",      releaseDate: "2024-01", series: "SV", kind: "拡張" },
  SV4A:  { name: "シャイニートレジャーex", releaseDate: "2023-12", series: "SV", kind: "ハイクラス" },
  SV4M:  { name: "未来の一閃",            releaseDate: "2023-10", series: "SV", kind: "拡張" },
  SV4K:  { name: "古代の咆哮",            releaseDate: "2023-10", series: "SV", kind: "拡張" },
  SV3A:  { name: "レイジングサーフ",      releaseDate: "2023-09", series: "SV", kind: "強化拡張" },
  SV3:   { name: "黒炎の支配者",          releaseDate: "2023-07", series: "SV", kind: "拡張" },
  SV2A:  { name: "ポケモンカード151",     releaseDate: "2023-06", series: "SV", kind: "強化拡張" },
  SV2P:  { name: "スノーハザード",        releaseDate: "2023-04", series: "SV", kind: "拡張" },
  SV2D:  { name: "クレイバースト",        releaseDate: "2023-04", series: "SV", kind: "拡張" },
  SV1V:  { name: "バイオレット ex",       releaseDate: "2023-01", series: "SV", kind: "拡張" },
  SV1S:  { name: "スカーレット ex",       releaseDate: "2023-01", series: "SV", kind: "拡張" },
};

/**
 * set_code から弾正式名を引く。マスターに無い場合は null。
 * /cards/pokemon と /cards ランディングのセット表示で使う。
 */
export function getPokemonSetMeta(setCode: string): PokemonSetMeta | null {
  return POKEMON_SETS[setCode.toUpperCase()] ?? null;
}

/**
 * セット略号と弾名を併記したラベルを返す。マスター未登録時は略号のみ。
 * 例: 'M04 ニンジャスピナー' / 'XYZ' (未登録時)
 */
export function formatPokemonSetLabel(setCode: string): string {
  const meta = getPokemonSetMeta(setCode);
  if (!meta) return setCode;
  return `${setCode} ${meta.name}`;
}
