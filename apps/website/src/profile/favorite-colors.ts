import * as stylex from "@stylexjs/stylex";
import type { FavoriteColor } from "db/constants";

const DARK = "@media (prefers-color-scheme: dark)";

export const FAVORITE_COLOR_META: Record<FavoriteColor, { label: string; swatch: string }> = {
  red: { label: "赤", swatch: "#dc2626" },
  orange: { label: "オレンジ", swatch: "#ea580c" },
  amber: { label: "アンバー", swatch: "#d97706" },
  lime: { label: "ライム", swatch: "#65a30d" },
  green: { label: "緑", swatch: "#16a34a" },
  teal: { label: "ティール", swatch: "#0d9488" },
  sky: { label: "スカイ", swatch: "#0284c7" },
  blue: { label: "青", swatch: "#2563eb" },
  violet: { label: "バイオレット", swatch: "#7c3aed" },
  pink: { label: "ピンク", swatch: "#db2777" },
  brown: { label: "ブラウン", swatch: "#92400e" },
  gray: { label: "グレー", swatch: "#52525b" },
};

export const favoriteAccentStyles = stylex.create({
  red: {
    backgroundColor: { [DARK]: "rgba(239, 68, 68, 0.14)", default: "#fef2f2" },
    borderColor: { [DARK]: "rgba(248, 113, 113, 0.35)", default: "#fecaca" },
  },
  orange: {
    backgroundColor: { [DARK]: "rgba(249, 115, 22, 0.14)", default: "#fff7ed" },
    borderColor: { [DARK]: "rgba(251, 146, 60, 0.35)", default: "#fed7aa" },
  },
  amber: {
    backgroundColor: { [DARK]: "rgba(245, 158, 11, 0.14)", default: "#fffbeb" },
    borderColor: { [DARK]: "rgba(251, 191, 36, 0.35)", default: "#fde68a" },
  },
  lime: {
    backgroundColor: { [DARK]: "rgba(132, 204, 22, 0.14)", default: "#f7fee7" },
    borderColor: { [DARK]: "rgba(163, 230, 53, 0.35)", default: "#d9f99d" },
  },
  green: {
    backgroundColor: { [DARK]: "rgba(34, 197, 94, 0.14)", default: "#f0fdf4" },
    borderColor: { [DARK]: "rgba(74, 222, 128, 0.35)", default: "#bbf7d0" },
  },
  teal: {
    backgroundColor: { [DARK]: "rgba(20, 184, 166, 0.14)", default: "#f0fdfa" },
    borderColor: { [DARK]: "rgba(45, 212, 191, 0.35)", default: "#99f6e4" },
  },
  sky: {
    backgroundColor: { [DARK]: "rgba(14, 165, 233, 0.14)", default: "#f0f9ff" },
    borderColor: { [DARK]: "rgba(56, 189, 248, 0.35)", default: "#bae6fd" },
  },
  blue: {
    backgroundColor: { [DARK]: "rgba(59, 130, 246, 0.14)", default: "#eff6ff" },
    borderColor: { [DARK]: "rgba(96, 165, 250, 0.35)", default: "#bfdbfe" },
  },
  violet: {
    backgroundColor: { [DARK]: "rgba(139, 92, 246, 0.14)", default: "#f5f3ff" },
    borderColor: { [DARK]: "rgba(167, 139, 250, 0.35)", default: "#ddd6fe" },
  },
  pink: {
    backgroundColor: { [DARK]: "rgba(236, 72, 153, 0.14)", default: "#fdf2f8" },
    borderColor: { [DARK]: "rgba(244, 114, 182, 0.35)", default: "#fbcfe8" },
  },
  brown: {
    backgroundColor: { [DARK]: "rgba(180, 83, 9, 0.14)", default: "#faf5f0" },
    borderColor: { [DARK]: "rgba(217, 119, 6, 0.35)", default: "#e7d3be" },
  },
  gray: {
    backgroundColor: { [DARK]: "rgba(161, 161, 170, 0.14)", default: "#f4f4f5" },
    borderColor: { [DARK]: "rgba(161, 161, 170, 0.35)", default: "#d4d4d8" },
  },
});
