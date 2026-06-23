import { defineVars } from "@stylexjs/stylex";

// ダークモード対応のグローバルカラートークン
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

// アプリ共通UIカラートークン（フォーム、ボタン、カード等のセマンティック色）
export const uiTokens = defineVars({
  inputBorder: "#d6d6d6",
  errorRed: "#b00020",
  white: "#ffffff",
  cardBg: "#f6f7fb",
  darkBg: "#171717",
  darkText: "#333",
});

// アプリ共通のスペーシング・レイアウト
export const layoutTokens = defineVars({
  pageMaxWidth: "78rem",
  cardWidth: "32rem",
  accountCardWidth: "40rem",
  errorPageWidth: "34rem",
});
