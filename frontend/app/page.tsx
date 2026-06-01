import HomeHero from "../components/home/HomeHero";
import GradeApp from "../components/grade/GradeApp";
import AffiliateBlock from "../components/affiliate/AffiliateBlock";
import AdUnit from "../components/AdUnit";

export const revalidate = 600; // 10 分

// AdSense スロット ID は AdSense 管理画面 → 広告ユニット → ディスプレイ広告 から取得
const AD_SLOT_TOP = process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP ?? "";

export default function Home() {
  return (
    <>
      <HomeHero />
      <GradeApp />
      {AD_SLOT_TOP && (
        <AdUnit slot={AD_SLOT_TOP} className="my-6" />
      )}
      <AffiliateBlock context="top" />
    </>
  );
}
