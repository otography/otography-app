import * as stylex from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "@ui-sdk/react/drawer";
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area";
import { type AppleSong, artworkUrl } from "#/lib/musickit";
import type { PostView } from "#/lib/posts";
import { motion } from "#/motion.stylex";
import { AppShell } from "#/shell/AppShell";
import { PreviewToggle } from "#/songs/PreviewToggle";
import { useChatHistory } from "./ChatHistoryContext";
import { CloseIcon, MusicNoteIcon, SidebarIcon } from "./icons";
import { chatMedia, chatTokens as t } from "./tokens.stylex";

function HistorySongItem({ post, catalogSong }: { post: PostView; catalogSong?: AppleSong }) {
  const songTitle = post.song?.title ?? "（曲名なし）";
  const artistName = post.song?.artistName ?? "";

  return (
    <li {...stylex.props(styles.item)}>
      {post.song?.artworkUrl ? (
        <img
          src={artworkUrl(post.song.artworkUrl, 72)}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          {...stylex.props(styles.art)}
        />
      ) : (
        <div {...stylex.props(styles.art, styles.artFallback)} aria-hidden="true">
          <MusicNoteIcon />
        </div>
      )}
      <div {...stylex.props(styles.songMeta)}>
        {post.song?.url ? (
          <a
            href={post.song.url}
            target="_blank"
            rel="noreferrer"
            {...stylex.props(styles.songTitle, styles.songTitleLink)}
          >
            {songTitle}
          </a>
        ) : (
          <span {...stylex.props(styles.songTitle)}>{songTitle}</span>
        )}
        {artistName ? <span {...stylex.props(styles.songArtist)}>{artistName}</span> : null}
      </div>
      {catalogSong ? (
        <PreviewToggle song={catalogSong} title={songTitle} style={styles.previewBtn} />
      ) : null}
    </li>
  );
}

function HistoryList() {
  const { state, actions } = useChatHistory();

  if (state.isPending) {
    return (
      <div {...stylex.props(styles.stateText)} aria-busy="true">
        履歴を読み込んでいます…
      </div>
    );
  }

  if (state.error) {
    return (
      <div role="alert" {...stylex.props(styles.errorText)}>
        {state.error}
      </div>
    );
  }

  if (state.groups.length === 0) {
    return (
      <div {...stylex.props(styles.emptyBox)}>
        <p {...stylex.props(styles.emptyTitle)}>まだ投稿がありません</p>
        <p {...stylex.props(styles.emptyDesc)}>曲の感想を送ると、日付ごとにここに並びます。</p>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.groupList)}>
      {state.groups.map((group) => {
        const headingId = `history-date-${group.dateKey}`;
        return (
          <section key={group.dateKey} aria-labelledby={headingId} {...stylex.props(styles.group)}>
            <h3 id={headingId} {...stylex.props(styles.dateHeading)}>
              <time dateTime={group.dateKey}>{group.label}</time>
            </h3>
            <ul {...stylex.props(styles.items)}>
              {group.posts.map((post) => {
                const catalogSong = post.song
                  ? (state.catalogSongs.byId.get(post.song.appleSongId) ??
                    state.catalogSongs.byIsrc.get(post.song.isrc.toUpperCase()))
                  : undefined;
                return <HistorySongItem key={post.id} post={post} catalogSong={catalogSong} />;
              })}
            </ul>
          </section>
        );
      })}

      {state.hasNextPage ? (
        <div {...stylex.props(styles.moreWrap)}>
          <Button
            type="button"
            disabled={state.isFetchingNextPage}
            onClick={actions.fetchNextPage}
            {...stylex.props(styles.moreBtn)}
          >
            {state.isFetchingNextPage ? "読み込み中…" : "さらに読み込む"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function HistoryScrollBody() {
  return (
    <ScrollArea {...stylex.props(styles.scrollArea)}>
      <ScrollAreaViewport
        role="region"
        aria-label="日付ごとの投稿履歴"
        {...stylex.props(styles.scrollViewport)}
      >
        <ScrollAreaContent {...stylex.props(styles.scrollContent)}>
          <HistoryList />
        </ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar orientation="vertical">
        <ScrollAreaThumb />
      </ScrollAreaScrollbar>
    </ScrollArea>
  );
}

function Desktop() {
  const { state, actions } = useChatHistory();

  if (!state.isDesktop || !state.desktopOpen) return null;

  return (
    <aside aria-label="投稿履歴" {...stylex.props(styles.desktopSidebar)}>
      <div {...stylex.props(styles.sidebarHeader)}>
        <div {...stylex.props(styles.brand)}>
          <AppShell.BrandIcon />
          <AppShell.BrandName />
        </div>
        <Button
          type="button"
          aria-label="投稿履歴サイドバーを閉じる"
          onClick={() => actions.setDesktopOpen(false)}
          {...stylex.props(styles.iconBtn)}
        >
          <SidebarIcon />
        </Button>
      </div>
      <div {...stylex.props(styles.sectionBar)}>
        <h2 {...stylex.props(styles.sectionTitle)}>投稿した曲</h2>
      </div>
      <HistoryScrollBody />
    </aside>
  );
}

function MobileDrawer() {
  const { state, actions } = useChatHistory();

  if (state.isDesktop) return null;

  return (
    <Drawer side="left" open={state.mobileOpen} onOpenChange={actions.setMobileOpen}>
      <DrawerBackdrop {...stylex.props(styles.backdrop)} />
      <DrawerContent initialFocus="content" {...stylex.props(styles.drawerContent)}>
        <div {...stylex.props(styles.drawerHeader)}>
          <div {...stylex.props(styles.brand)}>
            <AppShell.BrandIcon />
            <DrawerTitle {...stylex.props(styles.drawerTitle)}>投稿した曲</DrawerTitle>
          </div>
          <DrawerClose aria-label="投稿履歴を閉じる" {...stylex.props(styles.iconBtn)}>
            <CloseIcon />
          </DrawerClose>
        </div>
        <HistoryScrollBody />
      </DrawerContent>
    </Drawer>
  );
}

function OpenTrigger() {
  const { state, actions } = useChatHistory();

  if (state.isDesktop && state.desktopOpen) return null;

  return (
    <Button
      type="button"
      aria-label="投稿履歴サイドバーを開く"
      onClick={() => {
        if (state.isDesktop) {
          actions.setDesktopOpen(true);
        } else {
          actions.setMobileOpen(true);
        }
      }}
      {...stylex.props(styles.iconBtn)}
    >
      <SidebarIcon />
    </Button>
  );
}

export const ChatHistorySidebar = {
  Desktop,
  MobileDrawer,
  OpenTrigger,
};

const sidebarEnter = stylex.keyframes({
  from: {
    opacity: 0,
    transform: "translateX(-8px)",
  },
  to: {
    opacity: 1,
    transform: "translateX(0)",
  },
});

const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const styles = stylex.create({
  desktopSidebar: {
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    width: 272,
    height: "100%",
    minHeight: 0,
    backgroundColor: t.surface,
    borderRightColor: t.border,
    borderRightStyle: "solid",
    borderRightWidth: 1,
    animationName: {
      default: sidebarEnter,
      [chatMedia.reducedMotion]: fadeIn,
    },
    animationDuration: {
      default: "180ms",
      [chatMedia.reducedMotion]: "120ms",
    },
    animationTimingFunction: {
      default: motion.easeOut,
      [chatMedia.reducedMotion]: "ease",
    },
    animationFillMode: "both",
  },
  sidebarHeader: {
    display: "flex",
    flexShrink: 0,
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
    paddingRight: 12,
    paddingBottom: 12,
    paddingLeft: 16,
  },
  brand: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    minWidth: 0,
  },
  sectionBar: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    paddingTop: 4,
    paddingRight: 16,
    paddingBottom: 6,
    paddingLeft: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    color: t.muted,
    letterSpacing: "0.02em",
  },
  scrollArea: {
    position: "relative",
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "0%",
    minHeight: 0,
    overflow: "hidden",
  },
  scrollViewport: {
    width: "100%",
    height: "100%",
  },
  scrollContent: {
    paddingTop: 4,
    paddingRight: 10,
    paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
    paddingLeft: 10,
  },
  groupList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  dateHeading: {
    paddingBlock: 2,
    paddingInline: 8,
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color: t.muted,
  },
  items: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: 0,
    margin: 0,
    listStyle: "none",
  },
  item: {
    display: "flex",
    gap: 9,
    alignItems: "center",
    paddingBlock: 6,
    paddingInline: 8,
    backgroundColor: {
      default: "transparent",
      ":hover": {
        default: "transparent",
        [chatMedia.hover]: t.hover,
      },
    },
    borderRadius: 10,
    transition: `background-color 140ms ${motion.easeOut}`,
  },
  art: {
    flexShrink: 0,
    width: 32,
    height: 32,
    objectFit: "cover",
    borderRadius: 6,
  },
  artFallback: {
    display: "grid",
    placeItems: "center",
    color: t.muted,
    backgroundColor: t.hover,
  },
  songMeta: {
    display: "flex",
    flex: "1",
    flexDirection: "column",
    gap: 1,
    minWidth: 0,
  },
  songTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.35,
    color: t.text,
    whiteSpace: "nowrap",
  },
  songTitleLink: {
    textDecoration: {
      default: "none",
      ":hover": {
        default: "none",
        [chatMedia.hover]: "underline",
      },
    },
  },
  songArtist: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 11.5,
    lineHeight: 1.3,
    color: t.muted,
    whiteSpace: "nowrap",
  },
  previewBtn: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 26,
    height: 26,
    padding: 0,
    color: {
      default: t.muted,
      ":hover": {
        default: t.muted,
        [chatMedia.hover]: t.text,
      },
    },
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": {
        default: "transparent",
        [chatMedia.hover]: t.surfaceElevated,
      },
    },
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 9999,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.95)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 150ms ${motion.easeOut}, background-color 140ms ${motion.easeOut}, color 140ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease, color 120ms ease",
    },
  },
  iconBtn: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 32,
    height: 32,
    padding: 0,
    color: {
      default: t.muted,
      ":hover": {
        default: t.muted,
        [chatMedia.hover]: t.text,
      },
    },
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": {
        default: "transparent",
        [chatMedia.hover]: t.hover,
      },
    },
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 8,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.96)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 150ms ${motion.easeOut}, background-color 140ms ${motion.easeOut}, color 140ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease, color 120ms ease",
    },
  },
  stateText: {
    paddingBlock: 24,
    paddingInline: 12,
    fontSize: 13,
    color: t.muted,
    textAlign: "center",
  },
  errorText: {
    paddingBlock: 12,
    paddingInline: 10,
    fontSize: 13,
    color: t.danger,
  },
  emptyBox: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    paddingBlock: 24,
    paddingInline: 12,
  },
  emptyTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: t.text,
  },
  emptyDesc: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.55,
    color: t.muted,
  },
  moreWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: 4,
    paddingBottom: 4,
  },
  moreBtn: {
    width: "100%",
    height: 32,
    paddingBlock: 0,
    paddingInline: 12,
    fontSize: 12,
    fontWeight: 500,
    color: t.muted,
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
    transition: `background-color 140ms ${motion.easeOut}, color 140ms ${motion.easeOut}`,
  },
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  drawerContent: {
    display: "flex",
    flexDirection: "column",
    width: "min(300px, 84vw)",
    height: "100dvh",
    color: t.text,
    backgroundColor: t.surface,
    borderRightColor: t.border,
    borderRightStyle: "solid",
    borderRightWidth: 1,
    boxShadow: t.shadow,
  },
  drawerHeader: {
    display: "flex",
    flexShrink: 0,
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
    paddingRight: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    borderBottomColor: t.border,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
  },
  drawerTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
});
