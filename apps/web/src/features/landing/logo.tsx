import * as stylex from "@stylexjs/stylex";
import { fontHeading } from "./tokens.stylex";

const styles = stylex.create({
  logo: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "2rem",
    fontFamily: fontHeading,
    fontSize: "clamp(1.35rem, 2.4vw, 1.85rem)",
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
    "@media (max-width: 640px)": {
      fontSize: "1.45rem",
    },
  },
});

export function Logo() {
  return <span {...stylex.props(styles.logo)}>otography</span>;
}
