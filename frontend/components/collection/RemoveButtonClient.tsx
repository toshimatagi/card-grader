"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export default function RemoveButtonClient({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (busy) return;
        if (!confirm("このカードをコレクションから削除しますか?")) return;
        setBusy(true);
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase
          .from("user_collections")
          .delete()
          .eq("id", id);
        if (error) {
          alert("削除に失敗しました");
          setBusy(false);
          return;
        }
        router.refresh();
      }}
      disabled={busy}
      className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 shrink-0 disabled:opacity-50"
      aria-label="コレクションから削除"
      title="コレクションから削除"
    >
      ✕
    </button>
  );
}
