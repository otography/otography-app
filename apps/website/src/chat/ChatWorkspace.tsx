import * as stylex from "@stylexjs/stylex";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@ui-sdk/react/avatar";
import { Button } from "@ui-sdk/react/button";
import { authClient } from "#/lib/auth-client";
import { type Me, meQuery } from "#/lib/auth";
import { PreviewPlayerProvider } from "#/songs/preview-player";
import { ChatComposer } from "./ChatComposer";
import { ChatProvider } from "./ChatProvider";
import { ChatThread } from "./ChatThread";
import { chatTokens as t } from "./tokens.stylex";
import "./chat.css";

function initials(name: string) {
  return Array.from(name.trim()).slice(0, 2).join("") || "U";
}

export function ChatWorkspace({ user }: { user: Me }) {
  const queryClient = useQueryClient();
  const shell = stylex.props(styles.shell);

  return (
    <PreviewPlayerProvider>
      <ChatProvider>
        <div {...shell} className={`chat-shell ${shell.className ?? ""}`}>
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
            <ChatThread user={user} />
          </main>

          <ChatComposer />
        </div>
      </ChatProvider>
    </PreviewPlayerProvider>
  );
}

const styles = stylex.create({
  shell: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100dvh",
    color: t.text,
    backgroundColor: t.bg,
  },
  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    paddingBlock: 12,
    paddingInline: 20,
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
      "@media (max-width: 540px)": "none",
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
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    width: "min(100%, 760px)",
    paddingTop: 24,
    paddingRight: 16,
    paddingBottom: 32,
    paddingLeft: 16,
    marginBlock: 0,
    marginInline: "auto",
  },
});
