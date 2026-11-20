import * as stylex from "@stylexjs/stylex";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@ui-sdk/react/avatar";
import { Button } from "@ui-sdk/react/button";
import { useEffect, useRef, useState } from "react";
import { authClient } from "#/lib/auth-client";
import { type Me, meQuery } from "#/lib/auth";
import { PreviewPlayerProvider } from "#/songs/preview-player";
import { ChatComposer } from "./ChatComposer";
import { ChatProvider } from "./ChatProvider";
import { ChatThread } from "./ChatThread";
import { chatMedia, chatTokens as t } from "./tokens.stylex";

function initials(name: string) {
  return Array.from(name.trim()).slice(0, 2).join("") || "U";
}

export function ChatWorkspace({ user }: { user: Me }) {
  const queryClient = useQueryClient();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // iOS Safari などでソフトウェアキーボード表示中に画面をスクロールしても
  // 入力欄がキーボード裏へ隠れないよう、シェルを visualViewport に追従させる。
  useEffect(() => {
    const shellEl = shellRef.current;
    if (!shellEl) return;

    const html = document.documentElement;
    const { body } = document;
    const prevHtml = {
      height: html.style.height,
      overflow: html.style.overflow,
      overscrollBehavior: html.style.overscrollBehavior,
    };
    const prevBody = {
      height: body.style.height,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
    };

    html.style.height = "100%";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    window.scrollTo(0, 0);

    const vv = window.visualViewport;

    const sync = () => {
      if (vv) {
        if (Math.abs(vv.scale - 1) > 0.01) return;
        shellEl.style.height = `${vv.height}px`;
        shellEl.style.top = `${vv.offsetTop}px`;
        setKeyboardOpen(window.innerHeight - vv.height > 100);
        return;
      }

      shellEl.style.height = `${window.innerHeight}px`;
      shellEl.style.top = "0px";
      setKeyboardOpen(false);
    };

    sync();

    if (vv) {
      vv.addEventListener("resize", sync);
      vv.addEventListener("scroll", sync);
    }
    window.addEventListener("resize", sync);

    return () => {
      html.style.height = prevHtml.height;
      html.style.overflow = prevHtml.overflow;
      html.style.overscrollBehavior = prevHtml.overscrollBehavior;
      body.style.height = prevBody.height;
      body.style.overflow = prevBody.overflow;
      body.style.overscrollBehavior = prevBody.overscrollBehavior;
      if (vv) {
        vv.removeEventListener("resize", sync);
        vv.removeEventListener("scroll", sync);
      }
      window.removeEventListener("resize", sync);
    };
  }, []);

  return (
    <PreviewPlayerProvider>
      <ChatProvider>
        <div ref={shellRef} {...stylex.props(styles.shell)}>
          <header {...stylex.props(styles.topbar)}>
            <div {...stylex.props(styles.brand)}>
              <span {...stylex.props(styles.brandDot)} aria-hidden="true" />
              <span {...stylex.props(styles.brandName)}>otography</span>
            </div>
            <div {...stylex.props(styles.account)}>
              <Avatar {...stylex.props(styles.avatarSm)}>
                {user.image ? (
                  <AvatarImage
                    src={user.image}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    {...stylex.props(styles.avatarImg)}
                  />
                ) : null}
                <AvatarFallback>
                  <span aria-hidden="true">{initials(user.name)}</span>
                  <span data-slot="visually-hidden">{user.name}</span>
                </AvatarFallback>
              </Avatar>
              <span {...stylex.props(styles.accountName)}>{user.name}</span>
              <Button
                type="button"
                {...stylex.props(styles.signoutBtn)}
                onClick={() =>
                  void authClient
                    .signOut()
                    .then(() => queryClient.invalidateQueries({ queryKey: meQuery.queryKey }))
                }
              >
                ログアウト
              </Button>
            </div>
          </header>

          <main {...stylex.props(styles.main)}>
            <div {...stylex.props(styles.mainInner)}>
              <ChatThread user={user} />
            </div>
          </main>

          <ChatComposer keyboardOpen={keyboardOpen} />
        </div>
      </ChatProvider>
    </PreviewPlayerProvider>
  );
}

const styles = stylex.create({
  shell: {
    position: "fixed",
    top: 0,
    right: 0,
    left: 0,
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    overflow: "hidden",
    color: t.text,
    colorScheme: "light dark",
    backgroundColor: t.bg,
  },
  topbar: {
    position: "relative",
    zIndex: 10,
    display: "flex",
    flexShrink: 0,
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    paddingInline: 20,
    paddingTop: "max(12px, env(safe-area-inset-top))",
    paddingBottom: 12,
    backgroundColor: `color-mix(in srgb, ${t.bg} 88%, transparent)`,
    borderBottomColor: t.border,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    backdropFilter: "blur(10px)",
  },
  brand: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  brandDot: {
    width: 10,
    height: 10,
    backgroundColor: t.primary,
    borderRadius: 9999,
  },
  brandName: {
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  account: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  avatarSm: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    overflow: "hidden",
    fontSize: 11,
    borderRadius: 9999,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  accountName: {
    display: {
      default: "inline",
      [chatMedia.compact]: "none",
    },
    fontSize: 13,
    color: t.muted,
  },
  signoutBtn: {
    height: 30,
    paddingBlock: 0,
    paddingInline: 10,
    fontSize: 12,
    fontWeight: 500,
    color: t.text,
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": t.hover,
    },
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 8,
  },
  main: {
    flexGrow: "1",
    flexShrink: "1",
    flexBasis: "0%",
    width: "100%",
    minHeight: 0,
    overflowY: "auto",
    overscrollBehaviorY: "contain",
  },
  mainInner: {
    display: "flex",
    flexDirection: "column",
    width: "min(100%, 760px)",
    minHeight: "100%",
    paddingTop: 24,
    paddingRight: 16,
    paddingBottom: 32,
    paddingLeft: 16,
    marginBlock: 0,
    marginInline: "auto",
  },
});
