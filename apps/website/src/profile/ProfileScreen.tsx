import { create, props as stylexProps } from "@stylexjs/stylex";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@ui-sdk/react/button";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { chatMedia, chatTokens as t } from "#/chat/tokens.stylex";
import { authClient } from "#/lib/auth-client";
import { meQuery } from "#/lib/auth";
import type { Me } from "#/lib/auth";
import { motion } from "#/motion.stylex";
import { AppShell } from "#/shell/AppShell";
import { MiniPlayerBar } from "#/songs/MiniPlayerBar";
import { usePreviewPlayer } from "#/songs/preview-player";
import { AppleMusicConnection } from "./AppleMusicConnection";
import { FavoriteArtistsPanel } from "./FavoriteArtistsPanel";
import { FavoriteSongsPanel } from "./FavoriteSongsPanel";
import { ArrowLeftIcon } from "./icons";
import { useProfile } from "./ProfileContext";
import { ProfileHero } from "./ProfileHero";
import { ProfilePostsPanel } from "./ProfilePostsPanel";
import { ProfileProvider } from "./ProfileProvider";

function ProfileTab({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsTab
      value={value}
      render={(props, tabState) => (
        <button
          type="button"
          {...props}
          {...stylexProps(styles.tab, tabState.selected && styles.tabSelected)}
        />
      )}
    >
      {children}
    </TabsTab>
  );
}

function ProfileWorkspaceContent() {
  const { state } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const player = usePreviewPlayer();
  const { preloadAppleMusic } = player.actions;

  useEffect(() => {
    preloadAppleMusic();
  }, [preloadAppleMusic]);

  const handleSignOut = () => {
    player.actions.close();
    void authClient.signOut().then(async () => {
      await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
      await navigate({ to: "/" });
    });
  };

  return (
    <div {...stylexProps(styles.shell)}>
      <div {...stylexProps(styles.stickyHeader)}>
        <AppShell.Topbar>
          <div {...stylexProps(styles.leftNav)}>
            <Button render={<Link to="/" />} {...stylexProps(styles.backBtn)}>
              <ArrowLeftIcon />
              <span>ホーム</span>
            </Button>
            <Link to="/" {...stylexProps(styles.brand)}>
              <AppShell.BrandIcon />
              <AppShell.BrandName style={styles.brandName} />
            </Link>
          </div>

          <AppShell.SignOutButton onClick={handleSignOut} />
        </AppShell.Topbar>

        <MiniPlayerBar />
      </div>

      <main {...stylexProps(styles.main)}>
        <div {...stylexProps(styles.inner)}>
          {state.profileError ? (
            <p role="alert" {...stylexProps(styles.errorBanner)}>
              {state.profileError}
            </p>
          ) : null}

          <ProfileHero />
          <AppleMusicConnection />

          <Tabs defaultValue="posts" {...stylexProps(styles.tabs)}>
            <TabsList aria-label="プロフィールセクション" {...stylexProps(styles.tabsList)}>
              <ProfileTab value="posts">投稿</ProfileTab>
              <ProfileTab value="songs">好きな曲</ProfileTab>
              <ProfileTab value="artists">好きなアーティスト</ProfileTab>
              <TabsIndicator {...stylexProps(styles.tabIndicator)} />
            </TabsList>

            <TabsPanel value="posts" {...stylexProps(styles.tabPanel)}>
              <ProfilePostsPanel />
            </TabsPanel>
            <TabsPanel value="songs" {...stylexProps(styles.tabPanel)}>
              <FavoriteSongsPanel />
            </TabsPanel>
            <TabsPanel value="artists" {...stylexProps(styles.tabPanel)}>
              <FavoriteArtistsPanel />
            </TabsPanel>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

export function ProfileScreen({ user }: { user: Me }) {
  return (
    <ProfileProvider user={user}>
      <ProfileWorkspaceContent />
    </ProfileProvider>
  );
}

const styles = create({
  shell: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100dvh",
    color: t.text,
    colorScheme: "light dark",
    backgroundColor: t.bg,
  },
  stickyHeader: {
    position: "sticky",
    top: 0,
    zIndex: 10,
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
  brandName: {
    display: {
      default: "inline",
      [chatMedia.compact]: "none",
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
});
