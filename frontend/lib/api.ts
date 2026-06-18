const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface SubGrade {
  score: number;
  detail: Record<string, unknown>;
}

export interface BackAnalysis {
  card_image: string;
  centering: SubGrade;
  centering_overlay: string;
  error?: string;
}

export interface IdentifiedCard {
  set_code: string | null;
  card_no: string | null;
  name_ja: string | null;
  rarity: string | null;
  confidence: number;
}

export interface GradeResult {
  id: string;
  overall_grade: number;
  confidence: number;
  card_image: string;
  card_type: string;
  sub_grades: {
    centering: SubGrade;
    surface: SubGrade;
    color_print: SubGrade;
    edges_corners: SubGrade;
  };
  overlay_images: Record<string, string>;
  back_analysis?: BackAnalysis | null;
  identified_card?: IdentifiedCard | null;
  created_at: string;
}

export interface HistoryItem {
  id: string;
  overall_grade: number;
  confidence: number;
  card_type: string;
  created_at: string;
}

export interface Rarity {
  id: string;
  name_ja: string;
  name_en: string;
  has_border: boolean;
  border_type: string;
  surface_type: string;
}

export interface Brand {
  id: string;
  name_ja: string;
  name_en: string;
  size: string;
  rarities: Rarity[];
}

export async function getBrands(): Promise<Brand[]> {
  const res = await fetch(`${API_BASE}/api/v1/brands`);
  if (!res.ok) throw new Error("ブランド情報の取得に失敗しました");
  return res.json();
}

export interface CornerPoints {
  tl: [number, number];
  tr: [number, number];
  br: [number, number];
  bl: [number, number];
}

export interface PreprocessResult {
  card_image: string;
  card_type: string;
  outer_box?: { left: number; right: number; top: number; bottom: number };
  original_image: string;
  original_corners: CornerPoints;
  original_size: { w: number; h: number };
}

export async function preprocessImage(
  frontImage: File,
  corners?: CornerPoints
): Promise<PreprocessResult> {
  const formData = new FormData();
  formData.append("front_image", frontImage);
  if (corners) {
    formData.append("corners", JSON.stringify(corners));
  }

  const res = await fetch(`${API_BASE}/api/v1/preprocess`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("画像の前処理に失敗しました");
  }

  return res.json();
}

export async function gradeCard(
  frontImage: File,
  cardType: string = "standard",
  brand: string = "",
  rarity: string = "",
  manualCentering?: Record<string, unknown>,
  backImage?: File | null,
  backManualCentering?: Record<string, unknown> | null,
): Promise<GradeResult> {
  const formData = new FormData();
  formData.append("front_image", frontImage);
  formData.append("card_type", cardType);
  formData.append("brand", brand);
  formData.append("rarity", rarity);
  if (manualCentering) {
    formData.append("manual_centering", JSON.stringify(manualCentering));
  }
  if (backImage) {
    formData.append("back_image", backImage);
  }
  if (backManualCentering) {
    formData.append("back_manual_centering", JSON.stringify(backManualCentering));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/grade`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("鑑定処理がタイムアウトしました。もう一度お試しください。");
    }
    throw new Error("サーバーに接続できませんでした。しばらく待ってからお試しください。");
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "鑑定処理に失敗しました" }));
    throw new Error(error.detail || "鑑定処理に失敗しました");
  }

  return res.json();
}

export async function getGrade(id: string): Promise<GradeResult> {
  const res = await fetch(`${API_BASE}/api/v1/grade/${id}`);
  if (!res.ok) throw new Error("鑑定結果の取得に失敗しました");
  const raw = await res.json();
  // API 側のフィールド名 (*_url) を frontend 期待 (*_image / *_images) に正規化
  // 旧フィールドが存在すればそちら優先、なければ URL 版から map する
  return {
    ...raw,
    card_image: raw.card_image ?? raw.card_image_url ?? "",
    overlay_images:
      raw.overlay_images ?? raw.overlay_image_urls ?? {},
  } as GradeResult;
}

export async function getHistory(): Promise<{ total: number; items: HistoryItem[] }> {
  const res = await fetch(`${API_BASE}/api/v1/history`);
  if (!res.ok) throw new Error("履歴の取得に失敗しました");
  return res.json();
}

export interface CardSuggestion {
  card_id: string;
  set_code: string;
  card_no: string;
  variant: string;
  rarity: string;
  name_ja: string;
  image_url: string | null;
  distance: number;
}

export interface SuggestCardsResult {
  candidates: CardSuggestion[];
  match_type: "ocr" | "phash";
  detected_code: string | null;
}

export interface IdentifyMatch {
  id: string;
  brand: string;
  set_code: string;
  card_no: string;
  variant: string;
  rarity: string;
  name_ja: string;
  image_url: string | null;
}

export interface IdentifyCardResult {
  code: string | null;
  set_code: string | null;
  card_no: string | null;
  name_ja: string | null;
  rarity: string | null;
  confidence: number;
  matched: IdentifyMatch[];
}

export async function identifyCard(
  frontImage: File
): Promise<IdentifyCardResult | { error: string }> {
  const formData = new FormData();
  formData.append("front_image", frontImage);
  try {
    const res = await fetch(`${API_BASE}/api/v1/cards/identify`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.detail || `API ${res.status}` };
    }
    return await res.json();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "通信エラー" };
  }
}

export async function suggestCards(
  frontImage: File,
  brand: string = "onepiece",
  limit: number = 5
): Promise<SuggestCardsResult> {
  const formData = new FormData();
  formData.append("front_image", frontImage);
  formData.append("brand", brand);
  formData.append("limit", String(limit));

  const res = await fetch(`${API_BASE}/api/v1/suggest_cards`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    return { candidates: [], match_type: "phash", detected_code: null };
  }
  const data = await res.json();
  return {
    candidates: data.candidates || [],
    match_type: data.match_type || "phash",
    detected_code: data.detected_code ?? null,
  };
}

export interface EbaySoldItem {
  title: string;
  price: number;
  currency: string;
  sold_date: string;
  image_url: string;
  item_url: string;
  condition: string;
}

export interface EbaySoldStats {
  avg_price: number;
  min_price: number;
  max_price: number;
  median_price: number;
  count: number;
}

export interface EbaySoldResult {
  items: EbaySoldItem[];
  stats: EbaySoldStats | null;
  total: number;
}

// =============================================================================
// 価格DB (Price History)
// =============================================================================

export interface PriceSnapshot {
  card_id: string;
  source: string;
  captured_at: string;
  price_type: "sell" | "buy";
  price: number | null;
  stock_status: string | null;
}

export type PriceConfidence = "high" | "medium" | "low";

export interface PriceStats {
  min: number;
  max: number;
  median: number;
  sourceCount: number;
  sampleCount: number;
  lastAt: string; // ISO timestamp
  confidence: PriceConfidence;
}

export interface CardVariant {
  id: string;
  brand: string;
  set_code: string;
  card_no: string;
  variant: string;
  rarity: string;
  name_ja: string;
  image_url: string | null;
  sell_price: number | null;
  buy_price: number | null;
  sell_stats: PriceStats | null;
  buy_stats: PriceStats | null;
  history: PriceSnapshot[];
}

export interface CardByCodeResult {
  code: string;
  cards: CardVariant[];
  gradePrices: CardGradePrice[];
}

export interface CardSummary {
  id: string;
  brand: string;
  set_code: string;
  card_no: string;
  variant: string;
  rarity: string;
  name_ja: string;
  image_url: string | null;
}

export interface CardSummaryWithPrice extends CardSummary {
  sell_price: number | null;
  buy_price: number | null;
}

import { sbGet, sbRpc } from "./supabase";

function cleanImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  const lower = u.toLowerCase();
  if (
    lower.includes("spacer.gif") ||
    lower.includes("noimage") ||
    lower.includes("no_image") ||
    lower.includes("no-image") ||
    lower.endsWith("/blank.gif")
  ) {
    return null;
  }
  return u;
}

export interface TrendingCard {
  card_id: string;
  brand: string;
  set_code: string;
  card_no: string;
  variant: string;
  rarity: string;
  name_ja: string;
  image_url: string | null;
  now_price: number;
  past_price: number;
  pct_change: number;
}

export async function getTrending(params: {
  brand?: string;
  periodHours: number;
  priceType?: "sell" | "buy";
  limit?: number;
}): Promise<TrendingCard[]> {
  const brand = params.brand ?? "onepiece";
  // pokemon は実質単一ソース (fullahead) なので min_sources=1 で動かす。
  // onepiece は複数ソースあるので 2 維持。
  const minSources = brand === "pokemon" ? 1 : 2;
  const items = await sbRpc<TrendingCard[]>("trending_cards_v3", {
    p_brand: brand,
    p_period_hours: params.periodHours,
    p_price_type: params.priceType ?? "sell",
    p_limit: params.limit ?? 50,
    p_min_sources: minSources,
  });
  // RPC が brand を返さないので呼び出し元のbrandを attach (フロント表示用)
  return items.map((c) => ({ ...c, brand, image_url: cleanImageUrl(c.image_url) }));
}

export async function searchCards(params: {
  brand?: string;
  set_code?: string;
  rarity?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: CardSummary[]; count: number }> {
  const brand = params.brand ?? "onepiece";
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const filters = [`brand=eq.${brand}`];
  if (params.set_code) filters.push(`set_code=eq.${params.set_code.toUpperCase()}`);
  if (params.rarity) filters.push(`rarity=eq.${params.rarity}`);
  if (params.q) filters.push(`name_ja=ilike.*${params.q}*`);

  const select = "id,brand,set_code,card_no,variant,rarity,name_ja,image_url";
  const qs =
    filters.join("&") +
    `&select=${select}` +
    `&order=set_code.asc,card_no.asc,variant.asc` +
    `&limit=${limit}&offset=${offset}`;

  const items = await sbGet<CardSummary[]>("cards", qs);
  const cleaned = items.map((c) => ({ ...c, image_url: cleanImageUrl(c.image_url) }));
  return { items: cleaned, count: cleaned.length };
}

export async function attachLatestPrices(
  cards: CardSummary[],
  periodHours: number = 168
): Promise<CardSummaryWithPrice[]> {
  if (cards.length === 0) return [];

  const since = new Date(Date.now() - periodHours * 3600 * 1000).toISOString();
  const PRICE_FLOOR = 10;
  const CHUNK = 100;
  const allSnaps: PriceSnapshot[] = [];

  for (let i = 0; i < cards.length; i += CHUNK) {
    const chunk = cards.slice(i, i + CHUNK);
    const ids = chunk.map((c) => c.id).join(",");
    const snaps = await sbGet<PriceSnapshot[]>(
      "price_snapshots",
      `card_id=in.(${ids})` +
        `&captured_at=gte.${since}` +
        `&select=card_id,source,captured_at,price_type,price,stock_status` +
        `&limit=20000`
    );
    allSnaps.push(...snaps);
  }

  const valid = allSnaps.filter(
    (s) =>
      s.price != null &&
      s.price >= PRICE_FLOOR &&
      s.stock_status !== "out_of_stock"
  );

  const byCard = new Map<string, PriceSnapshot[]>();
  for (const s of valid) {
    const list = byCard.get(s.card_id);
    if (list) list.push(s);
    else byCard.set(s.card_id, [s]);
  }

  // 店舗ベース価格 (price_snapshots) で sell/buy 算出
  const withStore = cards.map((c) => ({
    ...c,
    sell_price: latestPerSourceAggregate(byCard.get(c.id) ?? [], "sell"),
    buy_price: latestPerSourceAggregate(byCard.get(c.id) ?? [], "buy"),
  }));

  // 店舗 sell_price が無いカードは card_grade_prices_latest の raw 中央値で fallback
  // (ヤフオク等の Raw 売却価格データ。スウィープで追加した stub カードでも値がつく)
  const missingIds = withStore
    .filter((c) => c.sell_price == null)
    .map((c) => c.id);

  if (missingIds.length > 0) {
    try {
      const FALLBACK_CHUNK = 200;
      const rawMap = new Map<string, number>();
      for (let i = 0; i < missingIds.length; i += FALLBACK_CHUNK) {
        const idsChunk = missingIds.slice(i, i + FALLBACK_CHUNK);
        const rows = await sbGet<
          { card_id: string; price_median: number | null }[]
        >(
          "card_grade_prices_latest",
          `card_id=in.(${idsChunk.join(",")})` +
            `&grade=eq.raw` +
            `&select=card_id,price_median` +
            `&limit=20000`,
        );
        for (const r of rows) {
          if (r.price_median != null) rawMap.set(r.card_id, r.price_median);
        }
      }
      if (rawMap.size > 0) {
        return withStore.map((c) =>
          c.sell_price == null && rawMap.has(c.id)
            ? { ...c, sell_price: rawMap.get(c.id) ?? null }
            : c,
        );
      }
    } catch {
      // card_grade_prices_latest が未作成等 → fallback 不能、無視
    }
  }

  return withStore;
}

export async function listRarities(brand: string = "onepiece"): Promise<string[]> {
  const PAGE = 1000;
  const all: { rarity: string }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const chunk = await sbGet<{ rarity: string }[]>(
      "cards",
      `brand=eq.${brand}&select=rarity&limit=${PAGE}&offset=${offset}`
    );
    all.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  const uniq = Array.from(new Set(all.map((r) => r.rarity).filter(Boolean)));
  uniq.sort();
  return uniq;
}

export async function getCardByCode(code: string): Promise<CardByCodeResult> {
  const codeU = code.toUpperCase().replace(/\s+/g, "");
  if (!codeU.includes("-")) {
    throw new Error("型番は 'OP15-007' の形式で指定してください");
  }
  const [setCode, rawCardNo] = codeU.split("-", 2);
  const cardNo = rawCardNo.padStart(3, "0");

  const cardSelect = "id,brand,set_code,card_no,variant,rarity,name_ja,image_url";
  const cards = await sbGet<CardSummary[]>(
    "cards",
    `set_code=eq.${setCode}&card_no=eq.${cardNo}&select=${cardSelect}&order=variant.asc,rarity.asc`
  );
  if (cards.length === 0) {
    throw new Error(`${codeU} が見つかりません`);
  }

  const ids = cards.map((c) => c.id).join(",");
  const snapSelect = "card_id,source,captured_at,price_type,price,stock_status";
  const snapshots = await sbGet<PriceSnapshot[]>(
    "price_snapshots",
    `card_id=in.(${ids})&select=${snapSelect}&order=captured_at.asc&limit=10000`
  );

  const PRICE_FLOOR = 10;
  const validSnapshots = snapshots.filter(
    (s) =>
      s.price != null &&
      s.price >= PRICE_FLOOR &&
      s.stock_status !== "out_of_stock"
  );

  const byCard = new Map<string, PriceSnapshot[]>();
  for (const c of cards) byCard.set(c.id, []);
  for (const s of validSnapshots) {
    byCard.get(s.card_id)?.push(s);
  }

  const resultCards: CardVariant[] = cards.map((c) => {
    const all = byCard.get(c.id) ?? [];
    return {
      ...c,
      image_url: cleanImageUrl(c.image_url),
      sell_price: latestPerSourceAggregate(all, "sell"),
      buy_price: latestPerSourceAggregate(all, "buy"),
      sell_stats: computePriceStats(all, "sell"),
      buy_stats: computePriceStats(all, "buy"),
      history: [
        ...dailyAggregateSeries(c.id, all, "sell"),
        ...dailyAggregateSeries(c.id, all, "buy"),
      ],
    };
  });

  const cardIds = cards.map((c) => c.id);
  let gradePrices: CardGradePrice[] = [];
  try {
    gradePrices = await listGradePrices(cardIds);
  } catch {
    // grade prices unavailable — show Raw-only UI
  }

  return { code: `${setCode}-${cardNo}`, cards: resultCards, gradePrices };
}

function computePriceStats(
  snapshots: PriceSnapshot[],
  priceType: "sell" | "buy"
): PriceStats | null {
  const filtered = snapshots.filter(
    (s) => s.price_type === priceType && s.price != null
  );
  if (filtered.length === 0) return null;

  // latest per source: 表示価格と整合する形で min/max/median を出す
  const bySource = new Map<string, PriceSnapshot>();
  for (const s of filtered) {
    const cur = bySource.get(s.source);
    if (!cur || s.captured_at > cur.captured_at) bySource.set(s.source, s);
  }
  const latestPrices = Array.from(bySource.values(), (s) => s.price as number);
  if (latestPrices.length === 0) return null;

  const sorted = [...latestPrices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = aggregate(latestPrices) ?? min;

  const sourceCount = bySource.size;
  const sampleCount = filtered.length;
  const lastAt = filtered.reduce(
    (a, b) => (a.captured_at > b.captured_at ? a : b)
  ).captured_at;

  // 信頼度: ソース3+ かつ snapshot 5+ かつ レンジ幅が中央値の50%以内 → 高
  const spread = median > 0 ? (max - min) / median : 0;
  let confidence: PriceConfidence;
  if (sourceCount >= 3 && sampleCount >= 5 && spread <= 0.5) {
    confidence = "high";
  } else if (sourceCount >= 2) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return { min, max, median, sourceCount, sampleCount, lastAt, confidence };
}

function aggregate(values: number[]): number | null {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  if (values.length === 2) return Math.round((values[0] + values[1]) / 2);
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function latestPerSourceAggregate(
  snapshots: PriceSnapshot[],
  priceType: "sell" | "buy"
): number | null {
  const bySource = new Map<string, PriceSnapshot>();
  for (const s of snapshots) {
    if (s.price_type !== priceType) continue;
    const cur = bySource.get(s.source);
    if (!cur || s.captured_at > cur.captured_at) bySource.set(s.source, s);
  }
  return aggregate(Array.from(bySource.values(), (s) => s.price as number));
}

function dailyAggregateSeries(
  cardId: string,
  snapshots: PriceSnapshot[],
  priceType: "sell" | "buy"
): PriceSnapshot[] {
  const byDay = new Map<string, Map<string, PriceSnapshot>>();
  for (const s of snapshots) {
    if (s.price_type !== priceType) continue;
    const day = s.captured_at.slice(0, 10);
    let sources = byDay.get(day);
    if (!sources) {
      sources = new Map();
      byDay.set(day, sources);
    }
    const cur = sources.get(s.source);
    if (!cur || s.captured_at > cur.captured_at) sources.set(s.source, s);
  }
  const points: PriceSnapshot[] = [];
  byDay.forEach((sources, day) => {
    const agg = aggregate(Array.from(sources.values(), (s) => s.price as number));
    if (agg != null) {
      points.push({
        card_id: cardId,
        source: "",
        captured_at: `${day}T00:00:00Z`,
        price_type: priceType,
        price: agg,
        stock_status: null,
      });
    }
  });
  return points.sort((a, b) => a.captured_at.localeCompare(b.captured_at));
}

export async function listSets(brand: string = "onepiece"): Promise<{ sets: { set_code: string; count: number }[] }> {
  // PostgREST はデフォルトで1リクエスト最大1000件を返すため、ページングして全件取得
  const PAGE = 1000;
  const all: { set_code: string; card_no: string }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const chunk = await sbGet<{ set_code: string; card_no: string }[]>(
      "cards",
      `brand=eq.${brand}&select=set_code,card_no&order=set_code,card_no&limit=${PAGE}&offset=${offset}`
    );
    all.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  // ユニークな card_no で数える (variant 別の重複は除外)
  const unique: Record<string, Set<string>> = {};
  for (const it of all) {
    if (!unique[it.set_code]) unique[it.set_code] = new Set();
    unique[it.set_code].add(it.card_no);
  }
  const sets = Object.entries(unique)
    .map(([set_code, codes]) => ({ set_code, count: codes.size }))
    .sort((a, b) => a.set_code.localeCompare(b.set_code));
  return { sets };
}

// ============================================================
// グレード別価格 (PriceCharting 風: Raw / PSA10 / PSA9 / BGS 別)
// ============================================================

export type CardGrade = "raw" | "psa10" | "psa9" | "psa8" | "bgs10" | "bgs9.5";

export interface CardGradePrice {
  card_id: string;
  grade: CardGrade;
  source: string;
  captured_at: string;
  price_median: number | null;
  price_min: number | null;
  price_max: number | null;
  sample_count: number;
}

/**
 * card_id 群に対する最新グレード別価格を取得 (raw/psa10/psa9 等)。
 * テーブル未作成時 (migration 008 未適用時) は空配列で graceful fallback。
 */
export async function listGradePrices(
  cardIds: string[],
): Promise<CardGradePrice[]> {
  if (cardIds.length === 0) return [];
  const ids = cardIds.join(",");
  try {
    const rows = await sbGet<CardGradePrice[]>(
      "card_grade_prices_latest",
      `card_id=in.(${ids})&select=*`,
    );
    return rows;
  } catch {
    // テーブル/ビュー未作成、または PostgREST スキーマキャッシュ未反映時
    return [];
  }
}

/**
 * 単一グレードでの「現状価格 TOP」ランキング。
 * /trending/psa10, /trending/raw 等のページ向け。
 * brand 指定なしで両ブランド横断、指定で絞り込み。
 */
export interface GradeRankingRow {
  card_id: string;
  grade: CardGrade;
  price_median: number;
  price_min: number | null;
  price_max: number | null;
  sample_count: number;
  captured_at: string;
  brand: string;
  set_code: string;
  card_no: string;
  rarity: string;
  name_ja: string;
  image_url: string | null;
}

export async function listGradeRanking(params: {
  grade: CardGrade;
  brand?: string;
  limit?: number;
  minSamples?: number;
}): Promise<GradeRankingRow[]> {
  const limit = params.limit ?? 50;
  const minSamples = params.minSamples ?? 3;
  const select =
    "card_id,grade,price_median,price_min,price_max,sample_count,captured_at," +
    "cards!inner(brand,set_code,card_no,rarity,name_ja,image_url)";
  const filters: string[] = [
    `grade=eq.${params.grade}`,
    `sample_count=gte.${minSamples}`,
  ];
  if (params.brand) {
    filters.push(`cards.brand=eq.${params.brand}`);
  }
  filters.push(`select=${select}`);
  filters.push(`order=price_median.desc.nullslast`);
  filters.push(`limit=${limit * 2}`);  // brand フィルタ後で減ることを想定して多めに

  try {
    const rows = await sbGet<
      Array<{
        card_id: string;
        grade: CardGrade;
        price_median: number;
        price_min: number | null;
        price_max: number | null;
        sample_count: number;
        captured_at: string;
        cards: {
          brand: string;
          set_code: string;
          card_no: string;
          rarity: string;
          name_ja: string;
          image_url: string | null;
        };
      }>
    >("card_grade_prices_latest", filters.join("&"));

    return rows
      .filter((r) => r.cards != null)
      .map((r) => ({
        card_id: r.card_id,
        grade: r.grade,
        price_median: r.price_median,
        price_min: r.price_min,
        price_max: r.price_max,
        sample_count: r.sample_count,
        captured_at: r.captured_at,
        brand: r.cards.brand,
        set_code: r.cards.set_code,
        card_no: r.cards.card_no,
        rarity: r.cards.rarity,
        name_ja: r.cards.name_ja,
        image_url: cleanImageUrl(r.cards.image_url),
      }))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Raw → PSA10 のスプレッド倍率ランキング。
 * 同一カードで raw と psa10 両方データがあるカードのみ対象、
 * (psa10_median / raw_median) を比率として算出。
 *
 * 「鑑定に出すと一番得するカード」=「PSA10 にしたとき価格が大きく跳ねるカード」
 * を一覧化する PriceCharting にない独自軸。
 */
export interface SpreadRankingRow extends GradeRankingRow {
  raw_median: number;
  psa10_median: number;
  multiplier: number; // psa10 / raw
  diff: number; // psa10 - raw
}

export async function listSpreadRanking(params: {
  brand?: string;
  limit?: number;
  minSamples?: number;
  minRawPrice?: number;
}): Promise<SpreadRankingRow[]> {
  const limit = params.limit ?? 50;
  const minSamples = params.minSamples ?? 3;
  const minRawPrice = params.minRawPrice ?? 100;

  // psa10 と raw を別々に取って同じ card_id で結合
  const [psa10Rows, rawRows] = await Promise.all([
    listGradeRanking({
      grade: "psa10",
      brand: params.brand,
      limit: 500,
      minSamples,
    }),
    listGradeRanking({
      grade: "raw",
      brand: params.brand,
      limit: 500,
      minSamples,
    }),
  ]);

  const rawMap = new Map(rawRows.map((r) => [r.card_id, r]));
  const out: SpreadRankingRow[] = [];
  for (const p of psa10Rows) {
    const r = rawMap.get(p.card_id);
    if (!r || !r.price_median || r.price_median < minRawPrice) continue;
    const mult = p.price_median / r.price_median;
    out.push({
      ...p,
      raw_median: r.price_median,
      psa10_median: p.price_median,
      multiplier: mult,
      diff: p.price_median - r.price_median,
    });
  }
  out.sort((a, b) => b.multiplier - a.multiplier);
  return out.slice(0, limit);
}

export const GRADE_LABEL: Record<CardGrade, string> = {
  raw: "Raw (未鑑定)",
  psa10: "PSA10 (Gem Mint)",
  psa9: "PSA9 (Mint)",
  psa8: "PSA8 (NM-MT)",
  bgs10: "BGS10 (Pristine)",
  "bgs9.5": "BGS9.5 (Gem Mint)",
};

export const GRADE_DISPLAY_ORDER: CardGrade[] = [
  "psa10",
  "bgs10",
  "psa9",
  "bgs9.5",
  "psa8",
  "raw",
];

/**
 * 同一セット内の関連カード (前後 + ランダム数枚) を返す。
 * SEO 強化のため card 詳細ページの内部リンクとして使う。
 */
export async function listRelatedCards(
  setCode: string,
  currentCardNo: string,
  limit: number = 8,
): Promise<CardSummary[]> {
  const select = "id,brand,set_code,card_no,variant,rarity,name_ja,image_url";
  // 同一セットの全カード (variant=normal を優先)
  const items = await sbGet<CardSummary[]>(
    "cards",
    `set_code=eq.${setCode.toUpperCase()}&select=${select}&order=card_no.asc,variant.asc&limit=2000`,
  );
  // card_no でユニーク化 (variant 重複を除く)
  const seen = new Set<string>();
  const uniq: CardSummary[] = [];
  for (const c of items) {
    if (seen.has(c.card_no)) continue;
    seen.add(c.card_no);
    uniq.push(c);
  }
  // 自分自身を除外
  const others = uniq.filter((c) => c.card_no !== currentCardNo);
  // 前後カード優先 + ランダム抽出で limit 件
  const sorted = [...others].sort((a, b) => {
    const an = parseInt(a.card_no, 10);
    const bn = parseInt(b.card_no, 10);
    const cur = parseInt(currentCardNo, 10);
    const ad = Math.abs(an - cur);
    const bd = Math.abs(bn - cur);
    return ad - bd;
  });
  return sorted.slice(0, limit).map((c) => ({
    ...c,
    image_url: cleanImageUrl(c.image_url),
  }));
}

export async function searchEbaySold(
  query: string,
  brand: string = ""
): Promise<EbaySoldResult> {
  const params = new URLSearchParams({ q: query, brand });
  const res = await fetch(`${API_BASE}/api/v1/ebay/sold?${params}`);
  if (!res.ok) return { items: [], stats: null, total: 0 };
  const data = await res.json();
  return {
    items: data.items || [],
    stats: data.stats || null,
    total: data.total || 0,
  };
}
