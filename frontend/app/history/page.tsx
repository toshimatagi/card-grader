"use client";

import { useState, useEffect } from "react";
import { getHistory, HistoryItem } from "../../lib/api";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHistory()
      .then((data) => setItems(data.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const gradeColor = (score: number): string => {
    if (score >= 9) return "text-green-600 bg-green-50";
    if (score >= 7) return "text-blue-600 bg-blue-50";
    if (score >= 5) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">鑑定履歴</h1>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-3">📋</div>
          <p>鑑定履歴がありません</p>
          <a href="/" className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block">
            カードを鑑定する →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <a
              key={item.id}
              href={`/result?id=${item.id}`}
              className="block bg-white rounded-lg border shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">
                    {new Date(item.created_at).toLocaleString("ja-JP")}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {item.card_type === "standard" ? "スタンダード" : "スモール"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500">
                    信頼度 {(item.confidence * 100).toFixed(0)}%
                  </div>
                  <div
                    className={`text-xl font-bold px-3 py-1 rounded-lg ${gradeColor(
                      item.overall_grade
                    )}`}
                  >
                    {item.overall_grade.toFixed(1)}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
