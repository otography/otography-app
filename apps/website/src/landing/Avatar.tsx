import { create, props } from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";

const styles = create({
  base: {
    display: "inline-grid",
    flexGrow: "0",
    flexShrink: "0",
    flexBasis: "auto",
    placeItems: "center",
    width: "1.75rem",
    height: "1.75rem",
    fontSize: "0.75rem",
    fontWeight: 780,
    color: "#fff",
    backgroundImage: "linear-gradient(135deg, #1f2632, #8184ad)",
    borderRadius: "50%",
  },
});

type AvatarProps = {
  children: string;
  style?: StyleXStyles<{ width?: string; height?: string; fontSize?: string }>;
};

export function Avatar({ children, style }: AvatarProps) {
  return <span {...props(styles.base, style)}>{children}</span>;
}
