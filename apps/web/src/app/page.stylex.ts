import * as stylex from "@stylexjs/stylex";
import { fontBody, landingTokens as t } from "@/features/landing/tokens.stylex";

export const styles = stylex.create({
  page: {
    color: t.ink,
    backgroundImage: `radial-gradient(circle at 8% 5%, rgba(255, 238, 216, 0.82), transparent 26rem), radial-gradient(circle at 92% 72%, rgba(171, 164, 255, 0.22), transparent 30rem), linear-gradient(180deg, #fffefa 0%, ${t.paper} 58%, #fffaf0 100%)`,
    fontFamily: fontBody,
    letterSpacing: 0,
  },
});
