import * as stylex from "@stylexjs/stylex";

const DARK = "@media (prefers-color-scheme: dark)";

export const chatTokens = stylex.defineVars({
  bg: {
    default: "#ffffff",
    [DARK]: "#171717",
  },
  surface: {
    default: "#f7f7f8",
    [DARK]: "#212121",
  },
  surfaceElevated: {
    default: "#ffffff",
    [DARK]: "#2a2a2a",
  },
  hover: {
    default: "#ececef",
    [DARK]: "#343434",
  },
  border: {
    default: "#e2e2e6",
    [DARK]: "#363636",
  },
  borderStrong: {
    default: "#c9c9d0",
    [DARK]: "#4a4a4a",
  },
  text: {
    default: "#171717",
    [DARK]: "#f2f2f2",
  },
  muted: {
    default: "#595962",
    [DARK]: "#a3a3ab",
  },
  primary: {
    default: "#171717",
    [DARK]: "#f4f4f5",
  },
  primaryFg: {
    default: "#ffffff",
    [DARK]: "#171717",
  },
  danger: {
    default: "#c62828",
    [DARK]: "#f87171",
  },
  shadow: {
    default: "0 8px 30px rgba(0, 0, 0, 0.08)",
    [DARK]: "0 12px 36px rgba(0, 0, 0, 0.45)",
  },
});
