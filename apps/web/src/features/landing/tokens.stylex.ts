import { defineVars } from "@stylexjs/stylex";

// ランディングページ固有のカラートークン
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

// フォントペアリング: 見出し(Bricolage Grotesque)/ 本文(Figtree)/ アクセント(Geist Mono)
// いずれも和文は Zen Kaku Gothic New にフォールバックし、混植を成立させる
export const fontHeading = "var(--font-heading-en), var(--font-jp), sans-serif";
export const fontBody = "var(--font-body-en), var(--font-jp), sans-serif";
export const fontMono = "var(--font-geist-mono), var(--font-jp), monospace";
