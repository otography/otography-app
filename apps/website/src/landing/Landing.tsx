import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "@fontsource/zen-kaku-gothic-new/400.css";
import "@fontsource/zen-kaku-gothic-new/500.css";
import "@fontsource/zen-kaku-gothic-new/700.css";
import * as stylex from "@stylexjs/stylex";
import { useEffect } from "react";
import { Discovery } from "./Discovery";
import { FinalCta } from "./FinalCta";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { fontTokens, landingTokens as t } from "./tokens.stylex";

const LANDING_THEME_COLOR = "#fffdf8";

/** ログインしていない人に見せるランディングページ。旧アプリ（otography-app-old）のトップページを移した。 */
export function Landing() {
  // ランディングはライト固定のため、ステータスバーの色もヘッダー背景（#fffdf8）に合わせる。
  useEffect(() => {
    const metas = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
    );
    const previous = metas.map((meta) => ({ meta, content: meta.getAttribute("content") }));
    for (const meta of metas) {
      meta.setAttribute("content", LANDING_THEME_COLOR);
    }
    return () => {
      for (const { meta, content } of previous) {
        if (content !== null) meta.setAttribute("content", content);
      }
    };
  }, []);

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
    colorScheme: "light",
    backgroundImage: `radial-gradient(circle at 8% 5%, rgba(255, 238, 216, 0.82), transparent 26rem), radial-gradient(circle at 92% 72%, rgba(171, 164, 255, 0.22), transparent 30rem), linear-gradient(180deg, #fffefa 0%, ${t.paper} 58%, #fffaf0 100%)`,
  },
});
