import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { colors, radius, space } from "#/styles/tokens.stylex";

type ButtonProps = Omit<ComponentProps<"button">, "className" | "style">;

/** 枠線のボタン。 */
export function Button({ type = "button", ...props }: ButtonProps) {
  return <button type={type} {...props} {...stylex.props(styles.base)} />;
}

/** 主な操作（投稿、保存など）のボタン。 */
export function PrimaryButton({ type = "button", ...props }: ButtonProps) {
  return <button type={type} {...props} {...stylex.props(styles.base, styles.primary)} />;
}

/** 小さいボタン（一覧の中の並び替えや削除など）。 */
export function SmallButton({ type = "button", ...props }: ButtonProps) {
  return <button type={type} {...props} {...stylex.props(styles.base, styles.small)} />;
}

const styles = stylex.create({
  base: {
    paddingBlock: space.sm,
    paddingInline: space.md,
    color: colors.text,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    backgroundColor: {
      default: colors.background,
      ":hover": "#f5f5f5",
    },
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  primary: {
    color: colors.background,
    backgroundColor: {
      default: colors.accent,
      ":disabled": colors.border,
      ":hover": colors.accent,
    },
    borderColor: "transparent",
  },
  small: {
    paddingBlock: space.xs,
    paddingInline: space.sm,
    fontSize: 13,
  },
});
