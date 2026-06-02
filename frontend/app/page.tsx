import HomeHero from "../components/home/HomeHero";
import GradeApp from "../components/grade/GradeApp";
import AffiliateBlock from "../components/affiliate/AffiliateBlock";
import AdUnit from "../components/AdUnit";

export const revalidate = 600; // 10 分

export default function Home() {
  return (
    <>
      <HomeHero />
      <GradeApp />
      <AdUnit slot="9165817840" className="my-6" />
      <AffiliateBlock context="top" />
    </>
  );
}
