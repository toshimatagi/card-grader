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
  latest_sell_price: number | null;
  latest_buy_price: number | null;
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

export async function searchCards(params: {
  brand?: string;
  set_code?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: CardSummary[]; count: number }> {
  const qs = new URLSearchParams();
  if (params.brand) qs.set("brand", params.brand);
  if (params.set_code) qs.set("set_code", params.set_code);
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  const res = await fetch(`${API_BASE}/api/v1/cards/search?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("カード検索に失敗しました");
  return res.json();
}

export async function getCardByCode(code: string): Promise<CardByCodeResult> {
  const res = await fetch(`${API_BASE}/api/v1/cards/by-code/${encodeURIComponent(code)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("カード情報の取得に失敗しました");
  return res.json();
}

export async function listSets(brand: string = "onepiece"): Promise<{ sets: { set_code: string; count: number }[] }> {
  const res = await fetch(`${API_BASE}/api/v1/cards/sets?brand=${brand}`, { cache: "no-store" });
  if (!res.ok) throw new Error("セット一覧の取得に失敗しました");
  return res.json();
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
