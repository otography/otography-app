import { create, props } from "@stylexjs/stylex";
import { fontTokens } from "./tokens.stylex";

const styles = create({
  logo: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "2rem",
    fontFamily: fontTokens.heading,
    fontSize: {
      default: "clamp(1.35rem, 2.4vw, 1.85rem)",
      "@media (max-width: 640px)": "1.45rem",
    },
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
  },
});

export function Logo() {
  return <span {...props(styles.logo)}>otography</span>;
}
