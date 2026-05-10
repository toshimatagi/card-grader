/**
 * ISO week ヘルパー: 2026-W19 形式の slug ↔ Date 変換
 * 月曜起点。週次値上がりレポート (/weekly/[slug]) で使用。
 */

export type WeekSlug = string; // "2026-W19"

export function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // 木曜日を含む週を ISO 週とする (Wikipedia ISO 8601)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNum };
}

export function formatWeekSlug(year: number, week: number): WeekSlug {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function parseWeekSlug(slug: string): { year: number; week: number } | null {
  const m = slug.match(/^(\d{4})-W(\d{1,2})$/i);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  if (week < 1 || week > 53) return null;
  return { year, week };
}

export function getWeekDateRange(year: number, week: number): { start: Date; end: Date } {
  // ISO week: 月曜開始、日曜終了
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const start = new Date(week1Mon);
  start.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

export function formatWeekRange(year: number, week: number): string {
  const { start, end } = getWeekDateRange(year, week);
  const fmt = (d: Date) =>
    `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `${year}年 W${week} (${fmt(start)} 〜 ${fmt(end)})`;
}

/** 直近 N 週分の slug を返す (current → 過去) */
export function recentWeekSlugs(n: number, baseDate: Date = new Date()): WeekSlug[] {
  const slugs: WeekSlug[] = [];
  const d = new Date(baseDate);
  for (let i = 0; i < n; i++) {
    const { year, week } = getISOWeek(d);
    slugs.push(formatWeekSlug(year, week));
    d.setUTCDate(d.getUTCDate() - 7);
  }
  return slugs;
}

export function currentWeekSlug(): WeekSlug {
  const { year, week } = getISOWeek(new Date());
  return formatWeekSlug(year, week);
}
