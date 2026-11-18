import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "@fontsource/zen-kaku-gothic-new/400.css";
import "@fontsource/zen-kaku-gothic-new/500.css";
import "@fontsource/zen-kaku-gothic-new/700.css";
import "./landing.css";
import * as stylex from "@stylexjs/stylex";
import { Discovery } from "./Discovery";
import { FinalCta } from "./FinalCta";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { fontTokens, landingTokens as t } from "./tokens.stylex";

/** ログインしていない人に見せるランディングページ。旧アプリ（otography-app-old）のトップページを移した。 */
export function Landing() {
  // landing クラスは landing.css の目印。StyleX の className と合わせて付ける。
  const page = stylex.props(styles.page);
  return (
    <main {...page} className={`landing ${page.className ?? ""}`}>
      <Header />
      <Hero />
      <HowItWorks />
      <Discovery />
      <FinalCta />
      <Footer />
    </main>
  );
}

const styles = stylex.create({
  page: {
    fontFamily: fontTokens.body,
    color: t.ink,
    letterSpacing: 0,
    backgroundImage: `radial-gradient(circle at 8% 5%, rgba(255, 238, 216, 0.82), transparent 26rem), radial-gradient(circle at 92% 72%, rgba(171, 164, 255, 0.22), transparent 30rem), linear-gradient(180deg, #fffefa 0%, ${t.paper} 58%, #fffaf0 100%)`,
  },
});
