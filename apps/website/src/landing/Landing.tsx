import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "@fontsource/zen-kaku-gothic-new/400.css";
import "@fontsource/zen-kaku-gothic-new/500.css";
import "@fontsource/zen-kaku-gothic-new/700.css";
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
  return (
    <main {...stylex.props(styles.page)}>
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
    overflowX: "clip",
    fontFamily: fontTokens.body,
    color: t.ink,
    letterSpacing: 0,
    backgroundImage: `radial-gradient(circle at 8% 5%, rgba(255, 238, 216, 0.82), transparent 26rem), radial-gradient(circle at 92% 72%, rgba(171, 164, 255, 0.22), transparent 30rem), linear-gradient(180deg, #fffefa 0%, ${t.paper} 58%, #fffaf0 100%)`,
  },
});
