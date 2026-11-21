import { create, props } from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import type { ReactNode } from "react";
import { chatMedia, chatTokens as t } from "#/chat/tokens.stylex";
import { motion } from "#/motion.stylex";

/** 画面上部のバー。position（固定・sticky など）は style で渡す。 */
function Topbar({ style, children }: { style?: StyleXStyles; children: ReactNode }) {
  return <header {...props(styles.topbar, style)}>{children}</header>;
}

function BrandIcon() {
  return (
    <img
      src="/otography-icon.png"
      alt=""
      aria-hidden="true"
      width={24}
      height={24}
      {...props(styles.brandIcon)}
    />
  );
}

function BrandName({ style }: { style?: StyleXStyles }) {
  return <span {...props(styles.brandName, style)}>otography</span>;
}

function SignOutButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick} {...props(styles.signoutBtn)}>
      ログアウト
    </Button>
  );
}

/** チャット画面とプロフィール画面で共通の、上部バーの部品。 */
export const AppShell = { Topbar, BrandIcon, BrandName, SignOutButton };

const styles = create({
  topbar: {
    zIndex: 10,
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: {
      default: "max(12px, env(safe-area-inset-top, 0px))",
      [chatMedia.compact]: "max(8px, env(safe-area-inset-top, 0px))",
    },
    paddingRight: {
      default: "max(20px, env(safe-area-inset-right, 0px))",
      [chatMedia.compact]: "max(14px, env(safe-area-inset-right, 0px))",
    },
    paddingBottom: {
      default: 12,
      [chatMedia.compact]: 8,
    },
    paddingLeft: {
      default: "max(20px, env(safe-area-inset-left, 0px))",
      [chatMedia.compact]: "max(14px, env(safe-area-inset-left, 0px))",
    },
    backgroundColor: `color-mix(in srgb, ${t.bg} 88%, transparent)`,
    borderBottomColor: t.border,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    backdropFilter: "blur(10px)",
  },
  brandIcon: {
    display: "block",
    flexShrink: 0,
    width: 24,
    height: 24,
    objectFit: "cover",
    borderRadius: 6,
  },
  brandName: {
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  signoutBtn: {
    height: {
      default: 30,
      [chatMedia.compact]: 28,
    },
    paddingBlock: 0,
    paddingInline: 10,
    fontSize: 12,
    fontWeight: 500,
    color: t.text,
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": {
        default: "transparent",
        [chatMedia.hover]: t.hover,
      },
    },
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 8,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 160ms ${motion.easeOut}, background-color 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease",
    },
  },
});
