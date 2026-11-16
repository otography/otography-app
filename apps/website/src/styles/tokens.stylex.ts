import * as stylex from "@stylexjs/stylex";

/** 余白の大きさ。 */
export const space = stylex.defineVars({
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
});

/** 色。 */
export const colors = stylex.defineVars({
  text: "#1a1a1a",
  textMuted: "#6b6b6b",
  border: "#d4d4d4",
  background: "#ffffff",
  accent: "#fa2d48",
});

/** 角の丸み。 */
export const radius = stylex.defineVars({
  sm: "4px",
  md: "8px",
});
