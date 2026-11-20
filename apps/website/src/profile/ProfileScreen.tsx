import * as stylex from "@stylexjs/stylex";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@ui-sdk/react/button";
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { Toast, ToastDescription, ToastRegion, ToastTitle } from "@ui-sdk/react/toast";
import { chatMedia, chatTokens as t } from "#/chat/tokens.stylex";
import { authClient } from "#/lib/auth-client";
import { type Me, meQuery } from "#/lib/auth";
import { motion } from "#/motion.stylex";
import { PreviewPlayerProvider } from "#/songs/preview-player";
import { FavoriteArtistsPanel } from "./FavoriteArtistsPanel";
import { FavoriteSongsPanel } from "./FavoriteSongsPanel";
import { ArrowLeftIcon } from "./icons";
import { useProfile } from "./ProfileContext";
import { ProfileHero } from "./ProfileHero";
import { ProfilePostsPanel } from "./ProfilePostsPanel";
import { ProfileProvider } from "./ProfileProvider";

function ProfileWorkspaceContent() {
  const { state, meta } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleSignOut = () => {
    void authClient.signOut().then(async () => {
      await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
      await navigate({ to: "/" });
    });
  };

  return (
    <div {...stylex.props(styles.shell)}>
      <header {...stylex.props(styles.topbar)}>
        <div {...stylex.props(styles.leftNav)}>
          <Button render={<Link to="/" />} {...stylex.props(styles.backBtn)}>
            <ArrowLeftIcon />
            <span>ホーム</span>
          </Button>
          <Link to="/" {...stylex.props(styles.brand)}>
            <img
              src="/otography-icon.png"
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
              {...stylex.props(styles.brandIcon)}
            />
            <span {...stylex.props(styles.brandName)}>otography</span>
          </Link>
        </div>

        <Button type="button" onClick={handleSignOut} {...stylex.props(styles.signoutBtn)}>
          ログアウト
        </Button>
      </header>

      <main {...stylex.props(styles.main)}>
        <div {...stylex.props(styles.inner)}>
          {state.profileError ? (
            <p role="alert" {...stylex.props(styles.errorBanner)}>
              {state.profileError}
            </p>
          ) : null}

          <ProfileHero />

          <Tabs defaultValue="posts" {...stylex.props(styles.tabs)}>
            <TabsList aria-label="プロフィールセクション" {...stylex.props(styles.tabsList)}>
              <TabsTab
                value="posts"
                render={(props, tabState) => (
                  <button
                    {...props}
                    {...stylex.props(styles.tab, tabState.selected && styles.tabSelected)}
                  />
                )}
              >
                投稿
              </TabsTab>
              <TabsTab
                value="songs"
                render={(props, tabState) => (
                  <button
                    {...props}
                    {...stylex.props(styles.tab, tabState.selected && styles.tabSelected)}
                  />
                )}
              >
                好きな曲
              </TabsTab>
              <TabsTab
                value="artists"
                render={(props, tabState) => (
                  <button
                    {...props}
                    {...stylex.props(styles.tab, tabState.selected && styles.tabSelected)}
                  />
                )}
              >
                好きなアーティスト
              </TabsTab>
              <TabsIndicator {...stylex.props(styles.tabIndicator)} />
            </TabsList>

            <TabsPanel value="posts" {...stylex.props(styles.tabPanel)}>
              <ProfilePostsPanel />
            </TabsPanel>
            <TabsPanel value="songs" {...stylex.props(styles.tabPanel)}>
              <FavoriteSongsPanel />
            </TabsPanel>
            <TabsPanel value="artists" {...stylex.props(styles.tabPanel)}>
              <FavoriteArtistsPanel />
            </TabsPanel>
          </Tabs>
        </div>
      </main>

      <ToastRegion toaster={meta.toaster} data-agent-hidden="" side="bottom" align="end">
        {() => (
          <Toast {...stylex.props(styles.toast)}>
            <ToastTitle {...stylex.props(styles.toastTitle)} />
            <ToastDescription {...stylex.props(styles.toastDesc)} />
          </Toast>
        )}
      </ToastRegion>
    </div>
  );
}

export function ProfileScreen({ user }: { user: Me }) {
  return (
    <PreviewPlayerProvider>
      <ProfileProvider user={user}>
        <ProfileWorkspaceContent />
      </ProfileProvider>
    </PreviewPlayerProvider>
  );
}

const styles = stylex.create({
  shell: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100dvh",
    color: t.text,
    colorScheme: "light dark",
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
  leftNav: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  backBtn: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    height: 30,
    paddingBlock: 0,
    paddingInline: 10,
    fontSize: 13,
    fontWeight: 500,
    color: t.text,
    textDecoration: "none",
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
  },
  brand: {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    color: t.text,
    textDecoration: "none",
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
    display: {
      default: "inline",
      [chatMedia.compact]: "none",
    },
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
  main: {
    flex: "1",
    width: "100%",
  },
  inner: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
    width: "min(100%, 760px)",
    paddingTop: {
      default: 28,
      [chatMedia.compact]: 16,
    },
    paddingRight: {
      default: "max(16px, env(safe-area-inset-right, 0px))",
      [chatMedia.compact]: "max(12px, env(safe-area-inset-right, 0px))",
    },
    paddingBottom: {
      default: "max(48px, env(safe-area-inset-bottom, 0px))",
      [chatMedia.compact]: "max(32px, env(safe-area-inset-bottom, 0px))",
    },
    paddingLeft: {
      default: "max(16px, env(safe-area-inset-left, 0px))",
      [chatMedia.compact]: "max(12px, env(safe-area-inset-left, 0px))",
    },
    marginBlock: 0,
    marginInline: "auto",
  },
  errorBanner: {
    paddingBlock: 12,
    paddingInline: 14,
    margin: 0,
    fontSize: 13,
    color: t.danger,
    backgroundColor: t.surface,
    borderColor: t.danger,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 12,
  },
  tabs: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  tabsList: {
    position: "relative",
    display: "flex",
    gap: 4,
    paddingBottom: 2,
    borderBottomColor: t.border,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
  },
  tab: {
    position: "relative",
    height: 38,
    paddingBlock: 0,
    paddingInline: {
      default: 14,
      [chatMedia.compact]: 10,
    },
    fontSize: {
      default: 14,
      [chatMedia.compact]: 13,
    },
    fontWeight: 500,
    color: {
      default: t.muted,
      ":hover": {
        default: t.muted,
        [chatMedia.hover]: t.text,
      },
    },
    cursor: "pointer",
    backgroundColor: "transparent",
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 8,
    transition: `color 150ms ${motion.easeOut}`,
  },
  tabSelected: {
    fontWeight: 600,
    color: t.text,
  },
  tabIndicator: {
    position: "absolute",
    bottom: -1,
    left: "var(--active-tab-left)",
    width: "var(--active-tab-width)",
    height: 2,
    backgroundColor: t.primary,
    borderRadius: 9999,
    transitionTimingFunction: motion.easeOut,
    transitionDuration: {
      default: "200ms",
      [chatMedia.reducedMotion]: "0ms",
    },
    transitionProperty: "left, width",
  },
  tabPanel: {
    outline: "none",
  },
  toast: {
    paddingBlock: 12,
    paddingInline: 14,
    color: t.text,
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 12,
    boxShadow: t.shadow,
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: 600,
  },
  toastDesc: {
    fontSize: 12,
    color: t.muted,
  },
});
