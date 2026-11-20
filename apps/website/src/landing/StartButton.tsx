import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { authClient } from "#/lib/auth-client";
import { motion } from "#/motion.stylex";
import { fontTokens } from "./tokens.stylex";

const styles = stylex.create({
  primaryLink: {
    display: "inline-flex",
    gap: "0.9rem",
    alignItems: "center",
    justifyContent: "center",
    justifySelf: "end",
    minWidth: "12rem",
    minHeight: "3.25rem",
    paddingBlock: "0",
    paddingInline: "1.65rem",
    fontFamily: fontTokens.body,
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "#fff",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
    cursor: "pointer",
    backgroundImage: "linear-gradient(180deg, #222631 0%, #11151d 100%)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderStyle: "solid",
    borderWidth: "1px",
    borderRadius: "999px",
    boxShadow: {
      default: "0 1rem 2rem rgba(17, 21, 29, 0.16)",
      ":hover": {
        default: "0 1rem 2rem rgba(17, 21, 29, 0.16)",
        "@media (hover: hover) and (pointer: fine)": "0 1.15rem 2.2rem rgba(17, 21, 29, 0.2)",
      },
    },
    transform: {
      default: null,
      ":hover": {
        default: null,
        "@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)":
          "translateY(-1px)",
      },
      ":active": {
        default: null,
        "@media (prefers-reduced-motion: no-preference)": "scale(0.97)",
      },
    },
    transition: {
      default: `transform 160ms ${motion.easeOut}, box-shadow 160ms ${motion.easeOut}`,
      "@media (prefers-reduced-motion: reduce)": "box-shadow 120ms ease",
    },
  },
});

type StartButtonProps = {
  // 置く場所ごとに変える幅と配置。値には、画面幅による条件付きの値（default が null のもの）も入る。
  style?: StyleXStyles<{
    width?: string | null;
    display?: string | null;
    minWidth?: string | null;
    justifySelf?: string | null;
  }>;
};

/** 「無料ではじめる」。Google でログインし、ログイン後はホーム（/）に戻る。 */
export function StartButton({ style }: StartButtonProps) {
  return (
    <button
      type="button"
      onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: "/" })}
      {...stylex.props(styles.primaryLink, style)}
    >
      <span>無料ではじめる</span>
      <span aria-hidden="true">→</span>
    </button>
  );
}
