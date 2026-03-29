"use client";

import { useState, useEffect } from "react";
import { searchEbaySold, EbaySoldItem } from "../../lib/api";

interface Props {
  cardName: string;
  brand: string;
}

export default function EbaySoldPrices({ cardName, brand }: Props) {
  const [items, setItems] = useState<EbaySoldItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cardName.trim()) return;

    setLoading(true);
    setError(null);
    searchEbaySold(cardName, brand)
      .then((data) => {
        setItems(data);
        if (data.length === 0) setError("該当する販売履歴が見つかりませんでした");
      })
      .catch(() => setError("eBayデータの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [cardName, brand]);

  if (!cardName.trim()) return null;

  const avgPrice = items.length > 0
    ? items.reduce((sum, i) => sum + i.price, 0) / items.length
    : 0;

  const minPrice = items.length > 0 ? Math.min(...items.map(i => i.price)) : 0;
  const maxPrice = items.length > 0 ? Math.max(...items.map(i => i.price)) : 0;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span>💰</span>
        eBay 最近のSold価格
      </h2>

      {loading && (
        <div className="text-center py-6">
          <span className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          <p className="text-sm text-gray-500 mt-2">eBayを検索中...</p>
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-gray-500 text-center py-4">{error}</p>
      )}

      {!loading && items.length > 0 && (
        <>
          {/* 価格サマリー */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">平均</div>
              <div className="text-lg font-bold text-blue-700">
                ${avgPrice.toFixed(2)}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">最安</div>
              <div className="text-lg font-bold text-green-700">
                ${minPrice.toFixed(2)}
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">最高</div>
              <div className="text-lg font-bold text-red-700">
                ${maxPrice.toFixed(2)}
              </div>
            </div>
          </div>

          {/* 販売一覧 */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {items.map((item, i) => (
              <a
                key={i}
                href={item.item_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
              >
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt=""
                    className="w-12 h-12 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.title}</div>
                  <div className="text-xs text-gray-500 flex gap-2">
                    <span>{item.condition}</span>
                    <span>{new Date(item.sold_date).toLocaleDateString("ja-JP")}</span>
                  </div>
                </div>
                <div className="text-sm font-bold text-green-700 whitespace-nowrap">
                  ${item.price.toFixed(2)}
                </div>
              </a>
            ))}
          </div>

          <p className="text-xs text-gray-400 mt-3 text-center">
            eBay Sold Listings (最近売れた順)
          </p>
        </>
      )}
    </div>
  );
}
