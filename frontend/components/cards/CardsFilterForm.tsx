"use client";

import { useRef } from "react";

type SetOption = { set_code: string; count: number };
type SortOption = { value: string; label: string };

const SORTS: SortOption[] = [
  { value: "code", label: "型番順" },
  { value: "price-desc", label: "販売価格(高い順)" },
  { value: "price-asc", label: "販売価格(安い順)" },
  { value: "name", label: "カード名順" },
];

export function CardsFilterForm({
  sets,
  rarities,
  initialSet,
  initialRarity,
  initialQ,
  initialSort,
  action = "/cards",
  setLabels,
}: {
  sets: SetOption[];
  rarities: string[];
  initialSet: string;
  initialRarity: string;
  initialQ: string;
  initialSort: string;
  action?: string;
  /**
   * 事前計算された set_code → 表示ラベルのマップ。
   * 例: { 'M04': 'M04 ニンジャスピナー', 'M03': 'M03 ムニキスゼロ' }
   * 省略時は set_code をそのまま表示。
   * 関数は Server Component → Client Component に渡せないため Record で受け取る。
   */
  setLabels?: Record<string, string>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2"
      action={action}
      method="GET"
    >
      <select
        name="set"
        defaultValue={initialSet}
        onChange={() => formRef.current?.requestSubmit()}
        className="border px-3 py-2 rounded text-sm"
      >
        <option value="">全セット</option>
        {sets.map((s) => {
          const label = setLabels?.[s.set_code] ?? s.set_code;
          return (
            <option key={s.set_code} value={s.set_code}>
              {label} ({s.count})
            </option>
          );
        })}
      </select>

      <select
        name="rarity"
        defaultValue={initialRarity}
        onChange={() => formRef.current?.requestSubmit()}
        className="border px-3 py-2 rounded text-sm"
      >
        <option value="">全レアリティ</option>
        {rarities.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      <select
        name="sort"
        defaultValue={initialSort}
        onChange={() => formRef.current?.requestSubmit()}
        className="border px-3 py-2 rounded text-sm"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <div className="col-span-2 sm:col-span-1 flex gap-2">
        <input
          name="q"
          defaultValue={initialQ}
          placeholder="カード名で検索"
          className="border px-3 py-2 rounded text-sm flex-1 min-w-0"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm whitespace-nowrap"
        >
          検索
        </button>
      </div>
    </form>
  );
}
