// プロジェクト共通のブレイクポイント
// NOTE: defineConsts は SWC コンパイラで var(--hash) に解決されるためメディアクエリキーに使えない。plain const でインライン化させる。
export const breakpoints = {
  small: "@media (max-width: 640px)",
  medium: "@media (max-width: 980px)",
} as const;
