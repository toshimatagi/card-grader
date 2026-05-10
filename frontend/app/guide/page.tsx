import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "使い方 - TCG Authority 利用ガイド",
  description:
    "TCG Authority (ワンピカード・ポケカ価格DB & AI鑑定ツール) の使い方ガイド。価格DBの検索方法、値上がりランキングの読み方、AI鑑定の撮影のコツ、結果の見方まで網羅。",
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "使い方 - TCG Authority",
    description: "価格DB / 値上がりランキング / AI鑑定の使い方ガイド",
    url: "/guide",
  },
};

export default function GuidePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">利用ガイド</h1>
      <p className="text-gray-500 text-sm mb-8">
        TCG Authority (ワンピカード・ポケカ 価格DB & AI鑑定ツール) の使い方
      </p>

      {/* 目次 */}
      <nav className="bg-gray-50 rounded-xl border p-5 mb-10">
        <h2 className="font-semibold mb-3">目次</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
          <li><a href="#overview" className="hover:underline">TCG Authority とは</a></li>
          <li><a href="#prices" className="hover:underline">価格DB の使い方</a></li>
          <li><a href="#trending" className="hover:underline">値上がりランキングの使い方</a></li>
          <li><a href="#grade" className="hover:underline">AI鑑定 (表裏チェック) の使い方</a></li>
          <li><a href="#prepare" className="hover:underline">撮影のコツ</a></li>
          <li><a href="#result" className="hover:underline">鑑定結果の見方</a></li>
          <li><a href="#overlay" className="hover:underline">分析オーバーレイの見方</a></li>
          <li><a href="#history" className="hover:underline">鑑定履歴</a></li>
          <li><a href="#faq" className="hover:underline">よくある質問</a></li>
        </ol>
      </nav>

      {/* 詳細ガイド (個別記事) */}
      <section className="mb-10 p-5 rounded-xl border-2 border-blue-200 bg-blue-50">
        <h2 className="font-bold mb-3 text-blue-900">📖 詳細ガイド (個別記事)</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <a href="/guide/psa10-tousenritu" className="text-blue-700 hover:underline font-bold">
              → PSA10 取得率の実態と提出前にチェックすべき5項目
            </a>
            <p className="text-xs text-gray-600 ml-4 mt-0.5">
              PSA10 が出る確率の現実、阻害要因 (センタリング・コーナー等)、AI 鑑定でのセルフチェック手順
            </p>
          </li>
          <li>
            <a href="/guide/kantei-teisyutsu" className="text-blue-700 hover:underline font-bold">
              → 鑑定提出 完全マニュアル — PSA / BGS の選び方
            </a>
            <p className="text-xs text-gray-600 ml-4 mt-0.5">
              海外直送 vs 代行業者、費用・期間、提出ステップ、失敗パターン
            </p>
          </li>
          <li>
            <a href="/guide/mercari-takaku-uru" className="text-blue-700 hover:underline font-bold">
              → メルカリでカードを高く売るコツ
            </a>
            <p className="text-xs text-gray-600 ml-4 mt-0.5">
              タイトル・写真・価格設定・出品タイミング・梱包の実践テクニック
            </p>
          </li>
        </ul>
      </section>

      {/* 1. 概要 */}
      <section id="overview" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">1. TCG Authority とは</h2>
        <p className="text-gray-700 leading-relaxed mb-3">
          <strong>TCG Authority</strong> (tcg-authority.com) は、ワンピースカードゲームとポケモンカードゲームの<strong>相場・値上がり・状態鑑定</strong>を一括で確認できる無料ツールです。複数の取扱いサイトから1時間〜1日おきに価格データを集計し、各カードの販売中央値・買取価格・値上がり率を表示します。
        </p>
        <p className="text-gray-700 leading-relaxed mb-3">
          フリマアプリでカードを購入する前、PSA / BGS の鑑定提出前、カードショップでの仕入れ判断、コレクションの時価評価など、TCG プレイヤー・コレクター・仕入れ目的のいずれの用途にも対応しています。<strong>登録不要・完全無料</strong>でご利用いただけます。
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <div className="font-semibold mb-1">対応TCG (機能別)</div>
          <ul className="space-y-0.5">
            <li>📚 <strong>価格DB / 値上がり</strong>: ワンピース・ポケモン</li>
            <li>📸 <strong>AI鑑定</strong>: ワンピース・ポケモン・遊戯王・ドラゴンボール Fusion World</li>
          </ul>
        </div>
      </section>

      {/* 2. 価格DB */}
      <section id="prices" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">2. 価格DB の使い方</h2>
        <p className="text-gray-700 leading-relaxed mb-3">
          ヘッダーの「価格DB ▾」から各ブランドのDBにアクセスできます。
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 mb-4">
          <li><a href="/cards/onepiece" className="text-blue-600 hover:underline">/cards/onepiece</a> - ワンピース全カード</li>
          <li><a href="/cards/pokemon" className="text-blue-600 hover:underline">/cards/pokemon</a> - ポケモン全カード</li>
          <li><a href="/cards" className="text-blue-600 hover:underline">/cards</a> - ランディング (両ブランド・値上がり・FAQ)</li>
        </ul>

        <h3 className="font-semibold mt-5 mb-2">検索とフィルタ</h3>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li>カード名・型番 (例: <code className="bg-gray-100 px-1 rounded">OP15-118</code>, <code className="bg-gray-100 px-1 rounded">M04-117</code>) で部分一致検索</li>
          <li>セット (OP15 / ST30 / PRB02 / M04 / SV6a 等) で絞込み</li>
          <li>レアリティ (SR / SEC / L / SAR / UR / MUR 等) で絞込み</li>
          <li>並び順: 型番順 / 販売価格 高い〜安い / カード名順</li>
        </ul>

        <h3 className="font-semibold mt-5 mb-2">個別カードページの見方</h3>
        <p className="text-sm text-gray-700 leading-relaxed mb-2">
          カードをクリックすると、<strong>バリアント別の販売・買取価格・買取率・信頼度</strong>と過去90日の価格推移グラフが表示されます。
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li><strong>バリアント</strong>: 通常 / パラレル / スーパーパラレル / アルトアート / マンガレア など</li>
          <li><strong>販売中央値・買取中央値</strong>: 複数サイトから集計した中央値</li>
          <li><strong>倍率</strong>: 同型番内で最安バリアントを基準にした価格倍率 (3倍以上は「高額版」マーク)</li>
          <li><strong>買取率</strong>: 買取中央値 ÷ 販売中央値 × 100%。60%以上で需要が高い</li>
          <li><strong>信頼度バッジ</strong>: 高 (3サイト以上 + 5件以上 + 価格幅小) / 中 (2サイト以上) / 低 (それ以下)</li>
        </ul>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
          ⚠️ <strong>高額バリアントに注意</strong>: 同型番でも通常版とパラレル / アルトアート / SAR 等で<strong>数倍〜数十倍の価格差</strong>になることがあります。フリマで購入する際はレアリティ表記・イラスト・縁取りを必ず確認してください。
        </div>
      </section>

      {/* 3. 値上がりランキング */}
      <section id="trending" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">3. 値上がりランキングの使い方</h2>
        <p className="text-gray-700 leading-relaxed mb-3">
          ヘッダーの「値上がり」または <a href="/trending" className="text-blue-600 hover:underline">/trending</a> で、指定期間で価格中央値が上昇したカードを並べてチェックできます。
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 mb-3">
          <li><strong>ブランド</strong>: ワンピ / ポケカ で切替</li>
          <li><strong>期間</strong>: 24時間 / 7日間 / 30日間</li>
          <li><strong>価格種別</strong>: 販売価格 / 買取価格</li>
          <li><strong>並び順</strong>: 上昇率順 / 上昇額順 / 現在価格順</li>
          <li><strong>表示件数</strong>: 50 / 100 / 200</li>
        </ul>
        <p className="text-sm text-gray-600 leading-relaxed">
          短期スパイク (24h) は仕入れ判断に、長期トレンド (30d) はコレクション評価や中長期投資の参考にお使いください。
        </p>
      </section>

      {/* 4. 鑑定 */}
      <section id="grade" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">4. AI鑑定 (表裏チェック) の使い方</h2>
        <p className="text-gray-700 leading-relaxed mb-3">
          トップページ <a href="/" className="text-blue-600 hover:underline">/</a> で、カードの状態スコア (PSA基準を参考) を自動算出します。表面 + (任意で) 裏面の写真をアップロードしてください。
        </p>

        <h3 className="font-semibold mt-5 mb-2">手順</h3>
        <div className="space-y-3 text-gray-700 leading-relaxed">
          <div className="flex gap-3 items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">1</span>
            <div>
              <div className="font-medium">表面の写真をアップロード (必須)</div>
              <p className="text-sm text-gray-600">ドラッグ&ドロップ・ファイル選択・カメラ撮影 (スマホ) のいずれかで表面画像を登録します。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">2</span>
            <div>
              <div className="font-medium">裏面の写真をアップロード (推奨)</div>
              <p className="text-sm text-gray-600">裏面なしでも鑑定できますが、<strong>白かけ・角欠け・エッジ傷</strong>は裏面がないと判定できません。PSA提出前は両面登録を推奨します。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">3</span>
            <div>
              <div className="font-medium">AI識別の結果を確認 (自動)</div>
              <p className="text-sm text-gray-600">画像から自動でカードを識別し、型番・名前・レアリティを表示します (確度 40%以上で自動セット)。バリアント候補が複数ある場合は手動で選択。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">4</span>
            <div>
              <div className="font-medium">ブランド・レアリティを選択</div>
              <p className="text-sm text-gray-600">対応4ブランド (ワンピ・ポケカ・遊戯王・ドラゴンボール FW) から選択。レアリティは分析モード (ボーダー検出 / 金縁 / フルアート / 薄ボーダー等) を切り替えるために重要です。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">5</span>
            <div>
              <div className="font-medium">「チェックを開始」を押す</div>
              <p className="text-sm text-gray-600">前処理 (台形補正) が走り、センタリング測定UIに遷移します。通常 5〜15秒。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">6</span>
            <div>
              <div className="font-medium">センタリング測定 (自動 / 手動)</div>
              <p className="text-sm text-gray-600">「自動でスキップ」を押せば自動測定。手動で外枠 (黄色) と内枠 (緑) をドラッグ調整することで精度向上できます。裏面登録時は「2/2 裏面のセンタリング測定」も実施。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">7</span>
            <div>
              <div className="font-medium">鑑定結果を確認</div>
              <p className="text-sm text-gray-600">総合グレード (1〜10) とサブグレード4項目、各分析オーバーレイが表示されます。</p>
            </div>
          </div>
        </div>

        <h3 className="font-semibold mt-6 mb-2">📐 傾き手動調整 (オプション)</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          斜めから撮影した場合や四隅の自動検出がズレた場合、センタリング測定画面の「📐 傾き調整」ボタンで4点 (左上 / 右上 / 右下 / 左下) を手動で動かして再正面化できます。スマホでも拡大鏡が出るので位置調整がしやすいUI。
        </p>

        <div className="mt-4 bg-gray-50 border rounded-lg p-4 text-sm text-gray-600">
          <span className="font-semibold">対応形式:</span> JPEG / PNG / WebP (推奨 1000×1400px 以上、最大 20MB)
        </div>
      </section>

      {/* 5. 撮影のコツ */}
      <section id="prepare" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">5. 撮影のコツ</h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          正確な鑑定結果のために、以下のポイントを意識してください。
        </p>

        <div className="space-y-4">
          <div className="flex gap-3">
            <span className="text-green-600 text-xl flex-shrink-0">○</span>
            <div>
              <div className="font-medium">明るく均一な照明で撮影</div>
              <p className="text-sm text-gray-600">自然光やデスクライトが理想的。カードに影が落ちないように。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-green-600 text-xl flex-shrink-0">○</span>
            <div>
              <div className="font-medium">単色の背景 (白・黒・グレー) の上に置く</div>
              <p className="text-sm text-gray-600">カード領域の自動検出精度が上がります。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-green-600 text-xl flex-shrink-0">○</span>
            <div>
              <div className="font-medium">カードの正面からできるだけ垂直に撮影</div>
              <p className="text-sm text-gray-600">多少の傾きは自動補正されますが、正面に近いほど精度が高まります。傾きが残るときは手動で「📐 傾き調整」を活用。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-green-600 text-xl flex-shrink-0">○</span>
            <div>
              <div className="font-medium">カード全体 (四辺すべて) が写るように撮影</div>
              <p className="text-sm text-gray-600">四辺のボーダーが見える状態で撮影してください。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-red-500 text-xl flex-shrink-0">×</span>
            <div>
              <div className="font-medium">避けるべきこと</div>
              <p className="text-sm text-gray-600">
                フラッシュ撮影 (光の反射で傷検出に影響) / スリーブに入れたまま (反射・歪み) / 柄のある背景 / ぼやけた画像
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. 鑑定結果の見方 */}
      <section id="result" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">6. 鑑定結果の見方</h2>

        <h3 className="font-semibold mt-4 mb-2">総合グレード</h3>
        <p className="text-gray-700 leading-relaxed mb-3">
          4つの分析項目を重み付けして算出した、カード全体の状態を表す 1〜10 のスコアです。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">スコア</th>
                <th className="border p-2 text-left">評価</th>
                <th className="border p-2 text-left">状態の目安</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border p-2 font-medium text-green-700">10</td><td className="border p-2">Gem Mint</td><td className="border p-2">完璧な状態。肉眼で欠陥が見当たらない</td></tr>
              <tr><td className="border p-2 font-medium text-green-600">9 - 9.5</td><td className="border p-2">Mint</td><td className="border p-2">ほぼ完璧。微細な欠陥が1〜2箇所</td></tr>
              <tr><td className="border p-2 font-medium text-blue-600">8 - 8.5</td><td className="border p-2">Near Mint</td><td className="border p-2">非常に良好。軽微な傷やセンタリングのずれ</td></tr>
              <tr><td className="border p-2 font-medium text-blue-500">7 - 7.5</td><td className="border p-2">Near Mint-</td><td className="border p-2">良好だが目に見える欠陥あり</td></tr>
              <tr><td className="border p-2 font-medium text-yellow-600">5 - 6.5</td><td className="border p-2">Excellent〜Good</td><td className="border p-2">使用感あり。傷やホワイトニングが確認できる</td></tr>
              <tr><td className="border p-2 font-medium text-red-600">1 - 4.5</td><td className="border p-2">Fair〜Poor</td><td className="border p-2">大きなダメージ。折れや破れなど</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="font-semibold mt-6 mb-2">サブグレード (4項目)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">項目</th>
                <th className="border p-2 text-left">重み</th>
                <th className="border p-2 text-left">内容</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border p-2 font-medium">センタリング</td><td className="border p-2">20%</td><td className="border p-2">印刷がカードの中心にあるか。表裏のうち悪い方が採用されます</td></tr>
              <tr><td className="border p-2 font-medium">表面状態</td><td className="border p-2">35%</td><td className="border p-2">傷・スクラッチ・ホワイトニング・折れの有無と程度</td></tr>
              <tr><td className="border p-2 font-medium">色・印刷</td><td className="border p-2">20%</td><td className="border p-2">色褪せ・インクむら・印刷ズレの有無</td></tr>
              <tr><td className="border p-2 font-medium">エッジ・角</td><td className="border p-2">25%</td><td className="border p-2">辺の直線性・角の丸みの均一性・ダメージ。裏面登録時は裏面の角欠けも検出</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="font-semibold mt-6 mb-2">信頼度</h3>
        <p className="text-gray-700 leading-relaxed">
          鑑定結果の信頼性を示すパーセンテージです。画像の解像度が低い場合や、カード領域の自動検出がうまくいかなかった場合に低下します。70%以上であれば参考値として十分です。
        </p>
      </section>

      {/* 7. オーバーレイ */}
      <section id="overlay" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">7. 分析オーバーレイの見方</h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          結果画面の「分析画像」セクションでは、各分析の結果をカード画像に重ねて表示できます。タブを切り替えて確認してください。
        </p>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-1">センタリング</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><span className="inline-block w-3 h-3 bg-yellow-400 rounded mr-1"></span><span className="font-medium">黄色の枠:</span> カード外縁 (物理的な境界)</li>
              <li><span className="inline-block w-3 h-3 bg-green-400 rounded mr-1"></span><span className="font-medium">緑の枠:</span> 内部印刷領域 (アートワーク枠)</li>
              <li><span className="inline-block w-3 h-3 bg-red-500 rounded mr-1"></span><span className="font-medium">赤い矢印:</span> 中心のズレ方向と大きさ</li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-1">表面傷</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><span className="inline-block w-3 h-3 bg-red-500 rounded mr-1"></span><span className="font-medium">赤い枠:</span> スクラッチ (線状の傷)</li>
              <li><span className="inline-block w-3 h-3 bg-orange-400 rounded mr-1"></span><span className="font-medium">オレンジ:</span> ホワイトニング (白化)</li>
              <li><span className="inline-block w-3 h-3 bg-purple-500 rounded mr-1"></span><span className="font-medium">マゼンタ:</span> 角のダメージ</li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-1">色分析</h3>
            <p className="text-sm text-gray-600">
              彩度のヒートマップが表示されます。青色は彩度が低い (色褪せの可能性)、赤色は彩度が高い (良好な色味) を示します。
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-1">エッジ・角</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><span className="inline-block w-3 h-3 bg-green-400 rounded mr-1"></span><span className="font-medium">緑の枠:</span> 正常な角</li>
              <li><span className="inline-block w-3 h-3 bg-red-500 rounded mr-1"></span><span className="font-medium">赤い枠:</span> ダメージが検出された角</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 8. 履歴 */}
      <section id="history" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">8. 鑑定履歴</h2>
        <p className="text-gray-700 leading-relaxed">
          <a href="/history" className="text-blue-600 hover:underline">/history</a> ページで過去の鑑定結果を一覧確認できます。日付・スコア順で表示され、各結果をクリックすると詳細・画像・オーバーレイを再閲覧できます。履歴データは Supabase に永続保存され、サーバー再起動でリセットされません。
        </p>
      </section>

      {/* 9. FAQ */}
      <section id="faq" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">9. よくある質問</h2>
        <div className="space-y-3">
          {[
            {
              q: "鑑定結果は PSA / BGS の実際の鑑定と一致しますか?",
              a: "本ツールは PSA の基準を参考にした自動分析ですが、実際の PSA / BGS では専門家が目視で判定するため結果が異なる場合があります。あくまで提出前のセルフチェック・目安としてご利用ください。",
            },
            {
              q: "鑑定に時間がかかります",
              a: "鑑定APIサーバーが Render の Free プランでアイドル時にスリープするため、初回アクセス時は起動に30〜60秒かかる場合があります。2回目以降は通常 5〜15秒 で完了します。",
            },
            {
              q: "スリーブやケースに入れたまま鑑定できますか?",
              a: "スリーブの反射や歪みが傷として誤検出される可能性があるため、できるだけ裸の状態で撮影してください。",
            },
            {
              q: "裏面の鑑定はできますか?",
              a: "対応しています。表面+裏面の2枚をアップロードすると、裏面の角欠け・白かけ・センタリングも判定に含まれます。PSA / BGS は表裏のうち悪い方が採用されるため、両面チェックを推奨します。",
            },
            {
              q: "アップロードした画像はどうなりますか?",
              a: "鑑定結果と画像は Supabase Storage に保存され、履歴ページから再閲覧できます。履歴ページから個別に削除も可能です。",
            },
            {
              q: "価格DBの更新頻度はどれくらい?",
              a: "現役の主要セット (ワンピ最新ブースター・ポケカ MEGA シリーズ) は1時間おき、それ以外のセットは1日1回 (深夜) に自動更新します。",
            },
            {
              q: "ポケカの最新弾 (M04 等) は対応していますか?",
              a: "ポケモンカードは MEGA シリーズ (M3 / M4 / M2a) と SV シリーズの全カードを収録しています。新弾発売後は自動でセット一覧に追加されます。",
            },
            {
              q: "AI識別が間違った型番を出すことがあります",
              a: "AI識別 (Gemini) はカード写真から型番・レアリティを推定しますが、撮影角度・反射・解像度により誤識別することがあります。確度が低い場合は手動で型番入力・候補選択をお使いください。",
            },
            {
              q: "ソースになる取扱いサイトを教えてください",
              a: "差別化要素のため公開しておりません。複数の国内通販サイトから集計した中央値を表示しています。",
            },
          ].map((item, i) => (
            <details key={i} className="border rounded-lg [&_summary::-webkit-details-marker]:hidden">
              <summary className="p-4 cursor-pointer font-medium hover:bg-gray-50 flex items-center justify-between gap-2">
                <span>{item.q}</span>
                <span className="text-gray-400 text-xs">▼</span>
              </summary>
              <p className="px-4 pb-4 text-sm text-gray-700 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="text-center text-gray-400 text-xs pb-8 border-t pt-4">
        TCG Authority - tcg-authority.com
      </div>
    </div>
  );
}
