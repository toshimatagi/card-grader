"use client";

import { useRef } from "react";

type SetOption = { set_code: string; count: number };

export function CardsFilterForm({
  sets,
  initialSet,
  initialQ,
}: {
  sets: SetOption[];
  initialSet: string;
  initialQ: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="mb-6 flex gap-2 flex-wrap"
      action="/cards"
      method="GET"
    >
      <select
        name="set"
        defaultValue={initialSet}
        onChange={() => formRef.current?.requestSubmit()}
        className="border px-3 py-2 rounded"
      >
        <option value="">全セット</option>
        {sets.map((s) => (
          <option key={s.set_code} value={s.set_code}>
            {s.set_code} ({s.count})
          </option>
        ))}
      </select>
      <input
        name="q"
        defaultValue={initialQ}
        placeholder="カード名で検索"
        className="border px-3 py-2 rounded flex-1 min-w-[200px]"
      />
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        検索
      </button>
    </form>
  );
}
