"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export default function AccountForm({
  initialDisplayName,
}: {
  initialDisplayName: string;
}) {
  const [name, setName] = useState(initialDisplayName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || trimmed.length > 30) {
          setStatus("error");
          return;
        }
        setStatus("saving");
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setStatus("error");
          return;
        }
        const { error } = await supabase
          .from("user_profiles")
          .update({ display_name: trimmed })
          .eq("id", user.id);
        setStatus(error ? "error" : "saved");
      }}
      className="space-y-3"
    >
      <label className="block">
        <span className="text-xs text-gray-600">表示名 (公開画面には表示されません)</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className="mt-1 w-full border rounded px-3 py-2 text-sm"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "saving" ? "保存中..." : "保存"}
        </button>
        {status === "saved" && <span className="text-xs text-green-700">保存しました</span>}
        {status === "error" && (
          <span className="text-xs text-red-700">保存に失敗しました (1〜30文字)</span>
        )}
      </div>
    </form>
  );
}
