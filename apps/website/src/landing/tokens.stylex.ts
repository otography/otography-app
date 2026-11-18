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
// StyleX はファイルをまたぐ素の文字列定数を静的評価できず black hole になる(警告なしで
// fontFamily プロパティごと消える)ため、defineVars で解決可能な形にする
export const fontTokens = defineVars({
  heading: "var(--font-heading-en), var(--font-jp), sans-serif",
  body: "var(--font-body-en), var(--font-jp), sans-serif",
  mono: "var(--font-geist-mono), var(--font-jp), monospace",
});
