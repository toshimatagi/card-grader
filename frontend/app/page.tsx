import HomeHero from "../components/home/HomeHero";
import GradeApp from "../components/grade/GradeApp";

export const revalidate = 600; // 10 分

export default function Home() {
  return (
    <>
      <HomeHero />
      <GradeApp />
    </>
  );
}
