import { defineConsts, defineVars } from "@stylexjs/stylex";

const DARK = "@media (prefers-color-scheme: dark)";

const SURFACE_ELEVATED = { default: "#ffffff", [DARK]: "#2a2a2a" } as const;
const HOVER = { default: "#ececef", [DARK]: "#343434" } as const;
const BORDER = { default: "#e2e2e6", [DARK]: "#363636" } as const;
const BORDER_STRONG = { default: "#c9c9d0", [DARK]: "#4a4a4a" } as const;
const TEXT = { default: "#171717", [DARK]: "#f2f2f2" } as const;
const MUTED = { default: "#595962", [DARK]: "#a3a3ab" } as const;
const PRIMARY = { default: "#171717", [DARK]: "#f4f4f5" } as const;
const PRIMARY_FG = { default: "#ffffff", [DARK]: "#171717" } as const;

export const chatMedia = defineConsts({
  compact: "@media (max-width: 540px)",
  touch: "@media (pointer: coarse)",
  hover: "@media (hover: hover) and (pointer: fine)",
  reducedMotion: "@media (prefers-reduced-motion: reduce)",
});

export const chatPopover = defineConsts({
  maxHeight: 420,
  minHeight: 120,
  sideOffset: 10,
  collisionPadding: 16,
  collisionPaddingCompact: 8,
});

export const chatTokens = defineVars({
  bg: {
    default: "#ffffff",
    [DARK]: "#171717",
  },
  surface: {
    default: "#f7f7f8",
    [DARK]: "#212121",
  },
  surfaceElevated: SURFACE_ELEVATED,
  hover: HOVER,
  highlight: {
    default: "#f0f0f3",
    [DARK]: "#353538",
  },
  border: BORDER,
  borderStrong: BORDER_STRONG,
  text: TEXT,
  muted: MUTED,
  primary: PRIMARY,
  primaryFg: PRIMARY_FG,
  danger: {
    default: "#c62828",
    [DARK]: "#f87171",
  },
  shadow: {
    default: "0 8px 30px rgba(0, 0, 0, 0.08)",
    [DARK]: "0 12px 36px rgba(0, 0, 0, 0.45)",
  },
  // ui-sdk のテーマ変数（-- プレフィックスで :root にそのまま出力され、ポータル先にも効く）
  "--ui-background": SURFACE_ELEVATED,
  "--ui-foreground": TEXT,
  "--ui-muted": HOVER,
  "--ui-muted-foreground": MUTED,
  "--ui-border": BORDER,
  "--ui-input": BORDER_STRONG,
  "--ui-primary": PRIMARY,
  "--ui-primary-foreground": PRIMARY_FG,
  "--ui-ring": PRIMARY,
  "--ui-ring-border": BORDER_STRONG,
});
