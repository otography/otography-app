import * as stylex from "@stylexjs/stylex";
import { colors } from "#/styles/tokens.stylex";

const styles = stylex.create({
  base: {
    display: "inline-grid",
    flex: "0 0 auto",
    placeItems: "center",
    overflow: "hidden",
    fontWeight: 600,
    color: colors.textMuted,
    backgroundColor: colors.border,
    borderRadius: "50%",
  },
  image: { width: "100%", height: "100%", objectFit: "cover" },
  size: (size: number) => ({ width: size, height: size, fontSize: size * 0.45 }),
});

/** アカウントのアイコン。画像が無いアカウントは、表示名の 1 文字目を出す。 */
export function Avatar({
  name,
  image,
  size,
}: {
  name: string;
  image: string | null;
  size: number;
}) {
  return (
    <span {...stylex.props(styles.base, styles.size(size))} aria-hidden>
      {image ? (
        <img src={image} alt="" width={size} height={size} {...stylex.props(styles.image)} />
      ) : (
        Array.from(name)[0]
      )}
    </span>
  );
}
