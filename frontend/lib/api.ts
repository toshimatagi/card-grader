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

export async function gradeCard(
  frontImage: File,
  cardType: string = "standard"
): Promise<GradeResult> {
  const formData = new FormData();
  formData.append("front_image", frontImage);
  formData.append("card_type", cardType);

  const res = await fetch(`${API_BASE}/api/v1/grade`, {
    method: "POST",
    body: formData,
  });

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
