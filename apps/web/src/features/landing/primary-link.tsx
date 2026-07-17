import Link from "next/link";
import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { fontTokens } from "./tokens.stylex";

const styles = stylex.create({
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.9rem",
    minHeight: "3.25rem",
    whiteSpace: "nowrap",
    fontFamily: fontTokens.body,
    fontSize: "0.95rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    justifySelf: "end",
    minWidth: "12rem",
    padding: "0 1.65rem",
    color: "#fff",
    backgroundImage: "linear-gradient(180deg, #222631 0%, #11151d 100%)",
    border: "1px solid rgba(255, 255, 255, 0.16)",
    borderRadius: "999px",
    boxShadow: "0 1rem 2rem rgba(17, 21, 29, 0.16)",
    ":hover": {
      transform: "translateY(-1px)",
      boxShadow: "0 1.15rem 2.2rem rgba(17, 21, 29, 0.2)",
    },
  },
});

type PrimaryLinkProps = {
  href: string;
  style?: StyleXStyles<{
    width?: string;
    display?: string;
    minWidth?: string;
    justifySelf?: string;
    "@media (max-width: 640px)"?: { width?: string; display?: string };
  }>;
};

export function PrimaryLink({ href, style }: PrimaryLinkProps) {
  return (
    <Link href={href} {...stylex.props(styles.primaryLink, style)}>
      <span>無料ではじめる</span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
