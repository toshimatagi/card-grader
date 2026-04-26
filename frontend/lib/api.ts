const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface SubGrade {
  score: number;
  detail: Record<string, unknown>;
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

export async function preprocessImage(
  frontImage: File
): Promise<{ card_image: string; card_type: string }> {
  const formData = new FormData();
  formData.append("front_image", frontImage);

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
  manualCentering?: Record<string, unknown>
): Promise<GradeResult> {
  const formData = new FormData();
  formData.append("front_image", frontImage);
  formData.append("card_type", cardType);
  formData.append("brand", brand);
  formData.append("rarity", rarity);
  if (manualCentering) {
    formData.append("manual_centering", JSON.stringify(manualCentering));
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
  return res.json();
}

export async function getHistory(): Promise<{ total: number; items: HistoryItem[] }> {
  const res = await fetch(`${API_BASE}/api/v1/history`);
  if (!res.ok) throw new Error("履歴の取得に失敗しました");
  return res.json();
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
  history: PriceSnapshot[];
}

export interface CardByCodeResult {
  code: string;
  cards: CardVariant[];
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

import { sbGet } from "./supabase";

export async function searchCards(params: {
  brand?: string;
  set_code?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: CardSummary[]; count: number }> {
  const brand = params.brand ?? "onepiece";
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const filters = [`brand=eq.${brand}`];
  if (params.set_code) filters.push(`set_code=eq.${params.set_code.toUpperCase()}`);
  if (params.q) filters.push(`name_ja=ilike.*${params.q}*`);

  const select = "id,brand,set_code,card_no,variant,rarity,name_ja,image_url";
  const qs =
    filters.join("&") +
    `&select=${select}` +
    `&order=set_code.asc,card_no.asc,variant.asc` +
    `&limit=${limit}&offset=${offset}`;

  const items = await sbGet<CardSummary[]>("cards", qs);
  return { items, count: items.length };
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
      sell_price: latestPerSourceAggregate(all, "sell"),
      buy_price: latestPerSourceAggregate(all, "buy"),
      history: [
        ...dailyAggregateSeries(c.id, all, "sell"),
        ...dailyAggregateSeries(c.id, all, "buy"),
      ],
    };
  });

  return { code: `${setCode}-${cardNo}`, cards: resultCards };
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
  const items = await sbGet<{ set_code: string }[]>(
    "cards",
    `brand=eq.${brand}&select=set_code&limit=100000`
  );
  const counts: Record<string, number> = {};
  for (const it of items) counts[it.set_code] = (counts[it.set_code] ?? 0) + 1;
  const sets = Object.entries(counts)
    .map(([set_code, count]) => ({ set_code, count }))
    .sort((a, b) => a.set_code.localeCompare(b.set_code));
  return { sets };
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
