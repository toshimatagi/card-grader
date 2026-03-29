export default function GuidePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">利用マニュアル</h1>
      <p className="text-gray-500 text-sm mb-8">Card Grader TCG鑑定士 の使い方</p>

      {/* 目次 */}
      <nav className="bg-gray-50 rounded-xl border p-5 mb-10">
        <h2 className="font-semibold mb-3">目次</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
          <li><a href="#overview" className="hover:underline">Card Grader とは</a></li>
          <li><a href="#prepare" className="hover:underline">撮影のコツ</a></li>
          <li><a href="#upload" className="hover:underline">カード画像をアップロードする</a></li>
          <li><a href="#result" className="hover:underline">鑑定結果の見方</a></li>
          <li><a href="#overlay" className="hover:underline">分析オーバーレイの見方</a></li>
          <li><a href="#history" className="hover:underline">鑑定履歴</a></li>
          <li><a href="#faq" className="hover:underline">よくある質問</a></li>
        </ol>
      </nav>

      {/* 1. 概要 */}
      <section id="overview" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">1. Card Grader とは</h2>
        <p className="text-gray-700 leading-relaxed mb-3">
          Card Grader は、トレーディングカードの画像をアップロードするだけで、
          カードの状態を自動で鑑定するWebアプリケーションです。
        </p>
        <p className="text-gray-700 leading-relaxed mb-3">
          PSA (Professional Sports Authenticator) の基準を参考にした 1〜10 のスコアで
          カードの状態を評価します。実際のPSA鑑定の結果を保証するものではありませんが、
          売買前の状態チェックやコレクション管理の参考としてご活用いただけます。
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <span className="font-semibold">対応カード:</span> ポケモンカード / MTG / ワンピースカード / 遊戯王 など、TCG全般に対応しています。
        </div>
      </section>

      {/* 2. 撮影のコツ */}
      <section id="prepare" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">2. 撮影のコツ</h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          正確な鑑定結果を得るために、以下のポイントを意識して撮影してください。
        </p>

        <div className="space-y-4">
          <div className="flex gap-3">
            <span className="text-green-600 text-xl flex-shrink-0">○</span>
            <div>
              <div className="font-medium">明るく均一な照明で撮影</div>
              <p className="text-sm text-gray-600">自然光やデスクライトが理想的です。カードに影が落ちないようにしましょう。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-green-600 text-xl flex-shrink-0">○</span>
            <div>
              <div className="font-medium">単色の背景（白・黒・グレー）の上に置く</div>
              <p className="text-sm text-gray-600">カード領域の自動検出精度が上がります。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-green-600 text-xl flex-shrink-0">○</span>
            <div>
              <div className="font-medium">カードの正面からできるだけ垂直に撮影</div>
              <p className="text-sm text-gray-600">多少の傾きは自動補正されますが、正面に近いほど精度が高まります。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-green-600 text-xl flex-shrink-0">○</span>
            <div>
              <div className="font-medium">カード全体が写るように撮影</div>
              <p className="text-sm text-gray-600">四辺すべてのボーダーが見える状態で撮影してください。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-red-500 text-xl flex-shrink-0">×</span>
            <div>
              <div className="font-medium">避けるべきこと</div>
              <p className="text-sm text-gray-600">
                フラッシュ撮影（光の反射で傷検出に影響）/ スリーブに入れたまま /
                柄のある背景 / ぼやけた画像
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
          <span className="font-semibold">推奨解像度:</span> 1000 x 1400px 以上。スマートフォンのカメラで十分な品質が得られます。
        </div>
      </section>

      {/* 3. アップロード */}
      <section id="upload" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">3. カード画像をアップロードする</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <div className="flex gap-3 items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">1</span>
            <p>トップページの点線エリアにカード画像をドラッグ&ドロップ、またはクリックしてファイルを選択します。</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">2</span>
            <p>
              <span className="font-medium">カードタイプ</span>を選択します。
              ポケカ・MTG・ワンピースは「スタンダード (63x88mm)」、
              遊戯王は「スモール (59x86mm)」を選んでください。
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">3</span>
            <p>「鑑定開始」ボタンを押すと分析が始まります。通常 5〜15秒 で結果が表示されます。</p>
          </div>
        </div>
        <div className="mt-4 bg-gray-50 border rounded-lg p-4 text-sm text-gray-600">
          <span className="font-semibold">対応形式:</span> JPEG / PNG / WebP (最大 20MB)
        </div>
      </section>

      {/* 4. 鑑定結果の見方 */}
      <section id="result" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">4. 鑑定結果の見方</h2>

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

        <h3 className="font-semibold mt-6 mb-2">サブグレード（4項目）</h3>
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
              <tr><td className="border p-2 font-medium">センタリング</td><td className="border p-2">20%</td><td className="border p-2">印刷がカードの中心にあるか。左右・上下の比率で判定</td></tr>
              <tr><td className="border p-2 font-medium">表面状態</td><td className="border p-2">35%</td><td className="border p-2">傷・スクラッチ・ホワイトニング・折れの有無と程度</td></tr>
              <tr><td className="border p-2 font-medium">色・印刷</td><td className="border p-2">20%</td><td className="border p-2">色褪せ・インクむら・印刷ズレの有無</td></tr>
              <tr><td className="border p-2 font-medium">エッジ・角</td><td className="border p-2">25%</td><td className="border p-2">辺の直線性・角の丸みの均一性・角のダメージ</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="font-semibold mt-6 mb-2">信頼度</h3>
        <p className="text-gray-700 leading-relaxed">
          鑑定結果の信頼性を示すパーセンテージです。画像の解像度が低い場合や、
          カード領域の自動検出がうまくいかなかった場合に低下します。
          70%以上であれば参考値として十分です。
        </p>
      </section>

      {/* 5. オーバーレイ */}
      <section id="overlay" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">5. 分析オーバーレイの見方</h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          結果画面の「分析画像」セクションでは、各分析の結果をカード画像に重ねて表示できます。
          タブを切り替えて確認してください。
        </p>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-1">センタリング</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><span className="inline-block w-3 h-3 bg-yellow-400 rounded mr-1"></span><span className="font-medium">黄色の枠:</span> カード外縁（物理的な境界）</li>
              <li><span className="inline-block w-3 h-3 bg-green-400 rounded mr-1"></span><span className="font-medium">緑の枠:</span> 内部印刷領域（アートワーク枠）</li>
              <li><span className="inline-block w-3 h-3 bg-red-500 rounded mr-1"></span><span className="font-medium">赤い矢印:</span> 中心のズレ方向と大きさ</li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-1">表面傷</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><span className="inline-block w-3 h-3 bg-red-500 rounded mr-1"></span><span className="font-medium">赤い枠:</span> スクラッチ（線状の傷）</li>
              <li><span className="inline-block w-3 h-3 bg-orange-400 rounded mr-1"></span><span className="font-medium">オレンジ:</span> ホワイトニング（白化）</li>
              <li><span className="inline-block w-3 h-3 bg-purple-500 rounded mr-1"></span><span className="font-medium">マゼンタ:</span> 角のダメージ</li>
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-1">色分析</h3>
            <p className="text-sm text-gray-600">
              彩度のヒートマップが表示されます。青色は彩度が低い（色褪せの可能性）、
              赤色は彩度が高い（良好な色味）を示します。
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

      {/* 6. 履歴 */}
      <section id="history" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">6. 鑑定履歴</h2>
        <p className="text-gray-700 leading-relaxed">
          ナビゲーションの「履歴」からこれまでの鑑定結果を一覧で確認できます。
          日付・スコア順で表示され、各結果をクリックすると詳細を確認できます。
        </p>
        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
          <span className="font-semibold">注意:</span> 現在、鑑定履歴はサーバーのメモリ上に保存されています。
          サーバーが再起動すると履歴はリセットされます。
        </div>
      </section>

      {/* 7. FAQ */}
      <section id="faq" className="mb-10">
        <h2 className="text-xl font-bold mb-3 border-b pb-2">7. よくある質問</h2>
        <div className="space-y-4">
          {[
            {
              q: "PSAの実際の鑑定結果と一致しますか？",
              a: "本アプリはPSAの基準を参考にした自動分析です。実際のPSA鑑定では専門家が目視で判定するため、結果が異なる場合があります。あくまで参考値としてご利用ください。",
            },
            {
              q: "鑑定に時間がかかります",
              a: "初回アクセス時はサーバーの起動に30〜60秒かかる場合があります。2回目以降は通常5〜15秒で完了します。画像サイズが大きい場合は自動でリサイズされます。",
            },
            {
              q: "スリーブやケースに入れたまま鑑定できますか？",
              a: "スリーブの反射や歪みが傷として検出される可能性があるため、できるだけ裸の状態での撮影をお勧めします。",
            },
            {
              q: "裏面の鑑定はできますか？",
              a: "現在は表面のみの鑑定に対応しています。裏面対応は今後のアップデートで予定しています。",
            },
            {
              q: "アップロードした画像はどうなりますか？",
              a: "画像はサーバー上で鑑定処理にのみ使用され、処理後はメモリから削除されます。永続的な保存は行っていません。",
            },
          ].map((item, i) => (
            <details key={i} className="border rounded-lg">
              <summary className="p-4 cursor-pointer font-medium hover:bg-gray-50">
                {item.q}
              </summary>
              <p className="px-4 pb-4 text-sm text-gray-700 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="text-center text-gray-400 text-xs pb-8 border-t pt-4">
        Card Grader TCG鑑定士 v0.1.0
      </div>
    </div>
  );
}
