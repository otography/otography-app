import * as stylex from "@stylexjs/stylex";
import { landingTokens as t } from "@/features/landing/tokens.stylex";

const FONT_SANS = "var(--font-geist-sans), system-ui, sans-serif";

export const styles = stylex.create({
  page: {
    minHeight: "100svh",
    color: t.ink,
    backgroundImage: `radial-gradient(circle at 8% 5%, rgba(255, 238, 216, 0.82), transparent 26rem), radial-gradient(circle at 92% 72%, rgba(171, 164, 255, 0.22), transparent 30rem), linear-gradient(180deg, #fffefa 0%, ${t.paper} 58%, #fffaf0 100%)`,
    fontFamily: FONT_SANS,
    letterSpacing: 0,
  },
});
