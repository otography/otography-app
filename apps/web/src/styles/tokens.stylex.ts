import { defineVars } from "@stylexjs/stylex";

// ダークモード対応のカラートークン
export const colorTokens = defineVars({
  background: {
    default: "#ffffff",
    "@media (prefers-color-scheme: dark)": "#0a0a0a",
  },
  foreground: {
    default: "#171717",
    "@media (prefers-color-scheme: dark)": "#ededed",
  },
});

// ランディングページ固有のカスタム色
export const landingTokens = defineVars({
  ink: "#171b26",
  muted: "#596070",
  line: "rgba(23, 27, 38, 0.09)",
  paper: "#fffdf8",
  paperSoft: "#f8f4eb",
  violet: "#a9a4ff",
  violetSoft: "#ded9ff",
  rose: "#f4a5b7",
  sun: "#ffd589",
});

// アプリ共通のスペーシング・レイアウト
export const layoutTokens = defineVars({
  pageMaxWidth: "78rem",
  cardWidth: "32rem",
  accountCardWidth: "40rem",
});

// フォーム共通カラー
export const formTokens = defineVars({
  inputBorder: "#d6d6d6",
  errorRed: "#b00020",
  white: "#ffffff",
  darkText: "#333",
  darkBg: "#171717",
  cardBg: "#f6f7fb",
});
