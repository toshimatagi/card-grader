"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import CardNameAutocomplete from "../cards/CardNameAutocomplete";
import type { CardSummary } from "../../lib/api";

/**
 * 鑑定結果ページから「この結果のカード型番」を指定して
 * グレード別相場を読み出すための入力 UI。
 *
 * ?card=M02A-126 を URL に付与してリロード → 親 server component が
 * その code でグレード別価格を取得・表示する。
 */
export default function GradeCardLinker({
  initialCode,
}: {
  initialCode?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [value, setValue] = useState(initialCode ?? "");

  const apply = (code: string) => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("card", code);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const clear = () => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.delete("card");
    router.replace(`${pathname}?${params.toString()}`);
    setValue("");
  };

  const onSelect = (c: CardSummary) => {
    const code = `${c.set_code}-${c.card_no}`;
    setValue(code);
    apply(code);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <CardNameAutocomplete
            value={value}
            onChange={setValue}
            onSelect={onSelect}
            placeholder="例: メガカイリュー / M02A-126 / リザードン"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const v = value.trim().toUpperCase();
            if (/^[A-Z]+\d+[A-Z]?-\d{1,3}$/.test(v)) {
              const [s, n] = v.split("-");
              apply(`${s}-${n.padStart(3, "0")}`);
            }
          }}
          disabled={!/^[A-Za-z]+\d+[A-Za-z]?-\d{1,3}$/.test(value.trim())}
          className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          相場を見る
        </button>
        {initialCode && (
          <button
            type="button"
            onClick={clear}
            className="px-3 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
          >
            クリア
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-500">
        ※ 候補から選ぶか、型番を入力して「相場を見る」を押してください
      </p>
    </div>
  );
}
