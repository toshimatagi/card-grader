"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import CardNameAutocomplete from "../cards/CardNameAutocomplete";
import type { CardSummary } from "../../lib/api";

/**
 * 鑑定結果ページから「この結果のカード型番」を指定して
 * グレード別相場を読み出すための入力 UI。
 *
 * 2 mode:
 *   - 型番直接入力 (例: OP15-066) — マニュアル入力派向け (デフォルト)
 *   - カード名検索 (autocomplete) — 型番を覚えてない人向け
 *
 * 親 server component は ?card=XXX を見て該当カードのグレード別価格を表示する。
 */
export default function GradeCardLinker({
  initialCode,
}: {
  initialCode?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [mode, setMode] = useState<"manual" | "search">("manual");
  const [manualValue, setManualValue] = useState(initialCode ?? "");
  const [searchValue, setSearchValue] = useState(initialCode ?? "");
  const [manualError, setManualError] = useState<string | null>(null);

  // initialCode 変更時に追従
  useEffect(() => {
    if (initialCode) {
      setManualValue(initialCode);
      setSearchValue(initialCode);
    }
  }, [initialCode]);

  const CODE_RE = /^[A-Z]+\d+[A-Z]?-\d{1,3}$/;

  function applyCode(code: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("card", code);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearCode() {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.delete("card");
    router.replace(`${pathname}?${params.toString()}`);
    setManualValue("");
    setSearchValue("");
    setManualError(null);
  }

  function submitManual() {
    setManualError(null);
    const raw = manualValue.trim().toUpperCase();
    if (!raw) {
      setManualError("型番を入力してください");
      return;
    }
    if (!CODE_RE.test(raw)) {
      setManualError("型番の形式が違います (例: OP15-066, M02A-126)");
      return;
    }
    const [s, n] = raw.split("-");
    applyCode(`${s}-${n.padStart(3, "0")}`);
  }

  function onSearchSelect(c: CardSummary) {
    const code = `${c.set_code}-${c.card_no}`;
    setSearchValue(code);
    setManualValue(code);
    applyCode(code);
  }

  return (
    <div className="space-y-3">
      {/* モード切替タブ */}
      <div className="flex gap-1 text-xs border-b border-gray-200">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`px-3 py-1.5 -mb-px border-b-2 ${
            mode === "manual"
              ? "border-blue-600 text-blue-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          ⌨️ 型番を直接入力
        </button>
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`px-3 py-1.5 -mb-px border-b-2 ${
            mode === "search"
              ? "border-blue-600 text-blue-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          🔍 カード名で検索
        </button>
      </div>

      {/* マニュアル入力モード */}
      {mode === "manual" && (
        <div className="space-y-2">
          <div className="flex gap-2 items-start flex-wrap sm:flex-nowrap">
            <input
              type="text"
              value={manualValue}
              onChange={(e) => {
                setManualValue(e.target.value);
                if (manualError) setManualError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitManual();
                }
              }}
              placeholder="例: OP15-066, M02A-126, SV11W-001"
              autoCapitalize="characters"
              spellCheck={false}
              className="flex-1 min-w-0 border rounded px-3 py-2 text-sm font-mono uppercase placeholder:font-sans placeholder:normal-case placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={submitManual}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 font-medium whitespace-nowrap"
            >
              相場を見る
            </button>
            {initialCode && (
              <button
                type="button"
                onClick={clearCode}
                className="px-3 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
              >
                クリア
              </button>
            )}
          </div>
          {manualError && (
            <p className="text-xs text-red-600">{manualError}</p>
          )}
          <p className="text-[11px] text-gray-500 leading-relaxed">
            カードの左下/右下に印字された型番をそのまま入力してください。
            形式: <code className="font-mono bg-gray-100 px-1 rounded">セット記号-番号</code>
            {" "}(例 <code className="font-mono bg-gray-100 px-1 rounded">OP15-066</code> /{" "}
            <code className="font-mono bg-gray-100 px-1 rounded">M02A-126</code>)。
            大文字小文字どちらでも OK、数字は自動でゼロ埋めされます。
          </p>
        </div>
      )}

      {/* 検索モード */}
      {mode === "search" && (
        <div className="space-y-2">
          <CardNameAutocomplete
            value={searchValue}
            onChange={setSearchValue}
            onSelect={onSearchSelect}
            placeholder="例: メガカイリュー / リザードン / ロロノア"
          />
          {initialCode && (
            <button
              type="button"
              onClick={clearCode}
              className="px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50"
            >
              選択中の型番をクリア
            </button>
          )}
          <p className="text-[11px] text-gray-500">
            ※ カード名を入力すると候補が出るので、該当カードを選んでください。
            型番を覚えてない時に便利です。
          </p>
        </div>
      )}
    </div>
  );
}
