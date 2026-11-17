import * as stylex from "@stylexjs/stylex";
import type { FavoriteColor } from "db/constants";

/** お気に入りの色の表示名。DB には英語の名前で保存している。 */
export const favoriteColorLabels: Record<FavoriteColor, string> = {
  red: "赤",
  orange: "オレンジ",
  amber: "琥珀",
  lime: "ライム",
  green: "緑",
  teal: "青緑",
  sky: "空色",
  blue: "青",
  violet: "紫",
  pink: "ピンク",
  brown: "茶",
  gray: "灰",
};

/** お気に入りの色の実際の色。左の帯として表示する。 */
export const favoriteColorStyles = stylex.create({
  red: { borderLeftColor: "#ef4444" },
  orange: { borderLeftColor: "#f97316" },
  amber: { borderLeftColor: "#f59e0b" },
  lime: { borderLeftColor: "#84cc16" },
  green: { borderLeftColor: "#22c55e" },
  teal: { borderLeftColor: "#14b8a6" },
  sky: { borderLeftColor: "#0ea5e9" },
  blue: { borderLeftColor: "#3b82f6" },
  violet: { borderLeftColor: "#8b5cf6" },
  pink: { borderLeftColor: "#ec4899" },
  brown: { borderLeftColor: "#92400e" },
  gray: { borderLeftColor: "#6b7280" },
});
