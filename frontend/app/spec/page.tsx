export default function SpecPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">システム仕様書</h1>
      <p className="text-gray-500 text-sm mb-8">Card Grader TCG鑑定士 v0.1.0</p>

      {/* 目次 */}
      <nav className="bg-gray-50 rounded-xl border p-5 mb-10">
        <h2 className="font-semibold mb-3">目次</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
          <li><a href="#system" className="hover:underline">システム概要</a></li>
          <li><a href="#architecture" className="hover:underline">システム構成</a></li>
          <li><a href="#pipeline" className="hover:underline">画像処理パイプライン</a></li>
          <li><a href="#centering" className="hover:underline">センタリング分析</a></li>
          <li><a href="#surface" className="hover:underline">表面傷検出</a></li>
          <li><a href="#color" className="hover:underline">色・印刷分析</a></li>
          <li><a href="#edges" className="hover:underline">エッジ・角分析</a></li>
          <li><a href="#grading" className="hover:underline">総合グレーディング</a></li>
          <li><a href="#api" className="hover:underline">API仕様</a></li>
          <li><a href="#limits" className="hover:underline">制約事項・既知の制限</a></li>
        </ol>
      </nav>

      {/* 1. システム概要 */}
      <section id="system" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">1. システム概要</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border">
            <tbody>
              <tr><td className="border p-2 bg-gray-50 font-medium w-1/3">システム名</td><td className="border p-2">Card Grader TCG鑑定士</td></tr>
              <tr><td className="border p-2 bg-gray-50 font-medium">バージョン</td><td className="border p-2">0.1.0</td></tr>
              <tr><td className="border p-2 bg-gray-50 font-medium">目的</td><td className="border p-2">TCGカードの画像を自動解析し、PSA基準に準じた1-10スケールのグレーディングスコアを算出する</td></tr>
              <tr><td className="border p-2 bg-gray-50 font-medium">対象カード</td><td className="border p-2">スタンダード (63x88mm): ポケモンカード / MTG / ワンピースカード 等<br/>スモール (59x86mm): 遊戯王 等</td></tr>
              <tr><td className="border p-2 bg-gray-50 font-medium">対応画像形式</td><td className="border p-2">JPEG / PNG / WebP (最大20MB)</td></tr>
              <tr><td className="border p-2 bg-gray-50 font-medium">推奨解像度</td><td className="border p-2">1000 x 1400px 以上 (処理時は長辺1200pxにリサイズ)</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. システム構成 */}
      <section id="architecture" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">2. システム構成</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border">
            <thead><tr className="bg-gray-100"><th className="border p-2 text-left">レイヤー</th><th className="border p-2 text-left">技術</th><th className="border p-2 text-left">ホスティング</th></tr></thead>
            <tbody>
              <tr><td className="border p-2">フロントエンド</td><td className="border p-2">Next.js 14 (App Router) + TypeScript + Tailwind CSS</td><td className="border p-2">Vercel</td></tr>
              <tr><td className="border p-2">バックエンド API</td><td className="border p-2">Python 3.12 + FastAPI</td><td className="border p-2">Render (Free)</td></tr>
              <tr><td className="border p-2">画像処理</td><td className="border p-2">OpenCV 4.10 + NumPy + scikit-image</td><td className="border p-2">-</td></tr>
              <tr><td className="border p-2">データ保存</td><td className="border p-2">インメモリ (MVP)</td><td className="border p-2">-</td></tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 bg-gray-900 text-green-400 rounded-lg p-4 text-xs font-mono leading-relaxed overflow-x-auto">
          <pre>{`[ブラウザ]  ──HTTPS──▶  [Vercel / Next.js]
                              │
                         POST /api/v1/grade (multipart)
                              │
                              ▼
                       [Render / FastAPI]
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              [前処理]  [4分析エンジン]  [スコア算出]
              カード検出   並列実行      重み付け合計
              傾き補正                   PSA変換`}</pre>
        </div>
      </section>

      {/* 3. 画像処理パイプライン */}
      <section id="pipeline" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">3. 画像処理パイプライン</h2>

        <h3 className="font-semibold mt-4 mb-2">3.1 前処理 (preprocessing.py)</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <p><span className="font-medium">入力画像のリサイズ:</span> 長辺1200pxを超える画像は処理前にリサイズ (INTER_AREA補間)</p>
          <p><span className="font-medium">カード領域検出:</span> Canny エッジ検出 → 輪郭抽出 → 面積最大の4角形を選択</p>
          <p><span className="font-medium">傾き補正:</span> 検出した4点からホモグラフィ変換で正面化 (cv2.getPerspectiveTransform + warpPerspective)</p>
          <p><span className="font-medium">カードタイプ推定:</span> アスペクト比からスタンダード (0.716) / スモール (0.686) を判定</p>
          <p><span className="font-medium">正面化後のリサイズ:</span> カード画像は長辺800pxにリサイズして分析モジュールに渡す</p>
        </div>
      </section>

      {/* 4. センタリング */}
      <section id="centering" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">4. センタリング分析 (centering.py)</h2>
        <p className="text-gray-700 text-sm leading-relaxed mb-3">
          カード外縁と内部印刷領域の中心ズレから、印刷の対称性を評価する。
          撮影位置に依存しないよう、外枠と内枠の相対的な位置関係で判定する。
        </p>

        <h3 className="font-semibold mt-4 mb-2">検出手法 (3手法のアンサンブル)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border">
            <thead><tr className="bg-gray-100"><th className="border p-2 text-left">手法</th><th className="border p-2 text-left">アルゴリズム</th></tr></thead>
            <tbody>
              <tr><td className="border p-2 font-medium">ボーダー色分離</td><td className="border p-2">HSV色空間でカード四辺のサンプリング → ボーダー色のマスク生成 → 反転して内部領域のバウンディングボックスを取得</td></tr>
              <tr><td className="border p-2 font-medium">エッジ密度勾配</td><td className="border p-2">Canny エッジ検出 → 四辺からスキャンしてエッジ密度が急増する位置を内部枠の境界とする</td></tr>
              <tr><td className="border p-2 font-medium">輪郭ベース矩形検出</td><td className="border p-2">膨張エッジ → 輪郭検出 → カード面積の30〜90%かつ矩形度が高い輪郭を内部枠とする</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600 mt-2">3手法の結果のメディアンを最終的な内部枠として採用し、安定性を確保。</p>

        <h3 className="font-semibold mt-4 mb-2">スコアリング基準 (PSA準拠)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border">
            <thead><tr className="bg-gray-100"><th className="border p-2">スコア</th><th className="border p-2">許容比率 (大きい側)</th></tr></thead>
            <tbody>
              <tr><td className="border p-2 text-center">10</td><td className="border p-2 text-center">52%以内</td></tr>
              <tr><td className="border p-2 text-center">9.5</td><td className="border p-2 text-center">55%以内</td></tr>
              <tr><td className="border p-2 text-center">9.0</td><td className="border p-2 text-center">57%以内</td></tr>
              <tr><td className="border p-2 text-center">8.0</td><td className="border p-2 text-center">62%以内</td></tr>
              <tr><td className="border p-2 text-center">7.0</td><td className="border p-2 text-center">67%以内</td></tr>
              <tr><td className="border p-2 text-center">6.0</td><td className="border p-2 text-center">73%以内</td></tr>
              <tr><td className="border p-2 text-center">3.0</td><td className="border p-2 text-center">80%超</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. 表面傷 */}
      <section id="surface" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">5. 表面傷検出 (surface.py)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border">
            <thead><tr className="bg-gray-100"><th className="border p-2 text-left">検出対象</th><th className="border p-2 text-left">アルゴリズム</th><th className="border p-2 text-left">深刻度判定</th></tr></thead>
            <tbody>
              <tr><td className="border p-2 font-medium">スクラッチ (線状傷)</td><td className="border p-2">ガウシアンブラーとの差分 → 閾値処理 → 線状構造強調 (方向カーネル) → アスペクト比3以上の輪郭</td><td className="border p-2">面積 &lt;200: minor / &lt;1000: major / 1000+: critical</td></tr>
              <tr><td className="border p-2 font-medium">ホワイトニング (白化)</td><td className="border p-2">カード端10%の領域で明度230以上のピクセル割合を計測</td><td className="border p-2">15〜30%: minor / 30%+: major</td></tr>
              <tr><td className="border p-2 font-medium">折れ・クリース</td><td className="border p-2">ラプラシアンフィルタ → Hough変換で長い直線検出 (カード長辺の15%以上)</td><td className="border p-2">長さ30%+: major / 30%未満: minor</td></tr>
              <tr><td className="border p-2 font-medium">角ダメージ</td><td className="border p-2">四角10%領域のエッジ密度 + テクスチャ標準偏差で異常度算出</td><td className="border p-2">スコア0.3〜0.6: minor / 0.6+: major</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          <span className="font-medium">スコア算出:</span> 欠陥なし=10.0、minor=-0.5、major=-1.5、critical=-3.0 のペナルティ方式 (0.5刻み、下限1.0)
        </p>
      </section>

      {/* 6. 色・印刷 */}
      <section id="color" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">6. 色・印刷分析 (color.py)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border">
            <thead><tr className="bg-gray-100"><th className="border p-2 text-left">分析項目</th><th className="border p-2 text-left">アルゴリズム</th><th className="border p-2 text-left">出力</th></tr></thead>
            <tbody>
              <tr><td className="border p-2 font-medium">色褪せ検出</td><td className="border p-2">HSV彩度チャネルの平均・標準偏差 + 明度チャネルの分布</td><td className="border p-2">0.0 (なし) 〜 1.0 (完全に色褪せ)</td></tr>
              <tr><td className="border p-2 font-medium">インク均一性</td><td className="border p-2">6x8グリッドに分割 → 隣接セルの彩度平均の差分を計測</td><td className="border p-2">0.0 (不均一) 〜 1.0 (均一)</td></tr>
              <tr><td className="border p-2 font-medium">彩度スコア</td><td className="border p-2">HSV彩度チャネルの平均と分散から品質評価</td><td className="border p-2">0.0 (低品質) 〜 1.0 (高品質)</td></tr>
              <tr><td className="border p-2 font-medium">ホロ/フォイル判定</td><td className="border p-2">色相のばらつき (std&gt;40) + 高彩度ピクセル比率 (30%+) + 明度変動 (std&gt;40)</td><td className="border p-2">true / false</td></tr>
              <tr><td className="border p-2 font-medium">印刷ズレ検出</td><td className="border p-2">RGB各チャネルのCannyエッジ位置の差異を計測</td><td className="border p-2">0.0 (なし) 〜 1.0 (大きなズレ)</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. エッジ・角 */}
      <section id="edges" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">7. エッジ・角分析 (edges.py)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border">
            <thead><tr className="bg-gray-100"><th className="border p-2 text-left">分析項目</th><th className="border p-2 text-left">アルゴリズム</th></tr></thead>
            <tbody>
              <tr><td className="border p-2 font-medium">エッジ直線性</td><td className="border p-2">四辺5%領域のCannyエッジ位置の標準偏差 → 小さいほど直線 (0.0〜1.0)</td></tr>
              <tr><td className="border p-2 font-medium">角の丸み均一性</td><td className="border p-2">四角8%領域のエッジ点の放射距離分布 → 変動係数で均一性評価 (0.0〜1.0)</td></tr>
              <tr><td className="border p-2 font-medium">角ダメージ検出</td><td className="border p-2">ラプラシアン標準偏差 + エッジ密度 + 明度標準偏差の複合スコア</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          <span className="font-medium">スコア算出:</span> エッジ直線性 x 40% + 角均一性 x 60% - 角ダメージペナルティ (minor: -0.5 / major: -1.5)
        </p>
      </section>

      {/* 8. 総合グレーディング */}
      <section id="grading" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">8. 総合グレーディング (grading.py)</h2>
        <h3 className="font-semibold mt-4 mb-2">重み付け</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border">
            <thead><tr className="bg-gray-100"><th className="border p-2">項目</th><th className="border p-2">重み</th><th className="border p-2">根拠</th></tr></thead>
            <tbody>
              <tr><td className="border p-2">センタリング</td><td className="border p-2 text-center">20%</td><td className="border p-2">製造由来の問題で個体差が大きい</td></tr>
              <tr><td className="border p-2">表面状態</td><td className="border p-2 text-center">35%</td><td className="border p-2">最も視覚的に目立つ欠陥</td></tr>
              <tr><td className="border p-2">色・印刷</td><td className="border p-2 text-center">20%</td><td className="border p-2">経年劣化の主要指標</td></tr>
              <tr><td className="border p-2">エッジ・角</td><td className="border p-2 text-center">25%</td><td className="border p-2">使用・保管状態の主要指標</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="font-semibold mt-4 mb-2">信頼度算出</h3>
        <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
          <li>カード輪郭の検出失敗: x 0.7</li>
          <li>画像解像度 500px未満: x 0.6 / 800px未満: x 0.8</li>
          <li>サブスコアの標準偏差 3.0超: x 0.8</li>
        </ul>
      </section>

      {/* 9. API仕様 */}
      <section id="api" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">9. API仕様</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border">
            <thead><tr className="bg-gray-100"><th className="border p-2">メソッド</th><th className="border p-2">パス</th><th className="border p-2">説明</th></tr></thead>
            <tbody>
              <tr><td className="border p-2 font-mono">POST</td><td className="border p-2 font-mono">/api/v1/grade</td><td className="border p-2">カード鑑定を実行 (multipart/form-data)</td></tr>
              <tr><td className="border p-2 font-mono">GET</td><td className="border p-2 font-mono">/api/v1/grade/&#123;id&#125;</td><td className="border p-2">鑑定結果を取得</td></tr>
              <tr><td className="border p-2 font-mono">GET</td><td className="border p-2 font-mono">/api/v1/history</td><td className="border p-2">鑑定履歴一覧</td></tr>
              <tr><td className="border p-2 font-mono">DELETE</td><td className="border p-2 font-mono">/api/v1/history/&#123;id&#125;</td><td className="border p-2">鑑定結果を削除</td></tr>
              <tr><td className="border p-2 font-mono">GET</td><td className="border p-2 font-mono">/health</td><td className="border p-2">ヘルスチェック</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="font-semibold mt-4 mb-2">POST /api/v1/grade</h3>
        <div className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs font-mono overflow-x-auto">
          <pre>{`// リクエスト (multipart/form-data)
front_image: File     // 必須。カード表面の画像
card_type:   string   // "standard" | "small" (デフォルト: "standard")

// レスポンス
{
  "id": "uuid",
  "overall_grade": 8.5,          // 1.0 - 10.0 (0.5刻み)
  "confidence": 0.87,            // 0.0 - 1.0
  "card_image": "base64...",     // 正面化されたカード画像
  "card_type": "standard",
  "sub_grades": {
    "centering":     { "score": 9.0, "detail": { ... } },
    "surface":       { "score": 8.0, "detail": { ... } },
    "color_print":   { "score": 9.0, "detail": { ... } },
    "edges_corners": { "score": 8.0, "detail": { ... } }
  },
  "overlay_images": {
    "centering":       "base64...",
    "surface_defects": "base64...",
    "color_analysis":  "base64...",
    "edges_corners":   "base64..."
  },
  "created_at": "2026-03-29T00:00:00+00:00"
}`}</pre>
        </div>
      </section>

      {/* 10. 制約事項 */}
      <section id="limits" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">10. 制約事項・既知の制限</h2>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="border-l-4 border-yellow-400 pl-3">
            <p className="font-medium">PSA公式鑑定との差異</p>
            <p>本システムは画像処理ベースの自動分析であり、PSA公式鑑定の結果を保証するものではありません。</p>
          </div>
          <div className="border-l-4 border-yellow-400 pl-3">
            <p className="font-medium">表面のみの分析</p>
            <p>現在は表面（おもて面）の画像のみを分析対象としています。裏面分析は未対応です。</p>
          </div>
          <div className="border-l-4 border-yellow-400 pl-3">
            <p className="font-medium">厚み分析の制限</p>
            <p>単一画像からカードの厚みを正確に測定することはできません。側面画像による分析は今後の課題です。</p>
          </div>
          <div className="border-l-4 border-yellow-400 pl-3">
            <p className="font-medium">ホロ・フォイルカードの精度</p>
            <p>ホログラフィックカードは光の反射が傷として誤検出される場合があります。均一な照明下での撮影を推奨します。</p>
          </div>
          <div className="border-l-4 border-yellow-400 pl-3">
            <p className="font-medium">サーバースリープ (Render Free)</p>
            <p>無料プランのため、15分間アクセスがないとサーバーがスリープします。初回アクセス時は起動に30〜60秒かかります。</p>
          </div>
          <div className="border-l-4 border-yellow-400 pl-3">
            <p className="font-medium">履歴の永続化</p>
            <p>鑑定履歴はサーバーメモリ上に保存されるため、サーバー再起動時にリセットされます。</p>
          </div>
        </div>
      </section>

      <div className="text-center text-gray-400 text-xs pb-8 border-t pt-4">
        Card Grader TCG鑑定士 v0.1.0 | 最終更新: 2026-03-29
      </div>
    </div>
  );
}
