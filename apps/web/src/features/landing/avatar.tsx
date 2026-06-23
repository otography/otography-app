import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";

const styles = stylex.create({
  base: {
    display: "inline-grid",
    placeItems: "center",
    flex: "0 0 auto",
    width: "1.75rem",
    height: "1.75rem",
    color: "#fff",
    fontSize: "0.75rem",
    fontWeight: 780,
    backgroundImage: "linear-gradient(135deg, #1f2632, #8184ad)",
    borderRadius: "50%",
  },
});

type AvatarProps = {
  children: string;
  style?: StyleXStyles<{ width?: string; height?: string; fontSize?: string }>;
};

export function Avatar({ children, style }: AvatarProps) {
  return <span {...stylex.props(styles.base, style)}>{children}</span>;
}
