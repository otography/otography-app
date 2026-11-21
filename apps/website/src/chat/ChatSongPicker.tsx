import { create, props } from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { artworkUrl } from "#/lib/musickit";
import { motion } from "#/motion.stylex";
import { useChat } from "./ChatContext";
import { MusicNoteIcon } from "./icons";
import { chatMedia, chatPopover, chatTokens as t } from "./tokens.stylex";

/** @ / で開く曲の検索候補ポップオーバー。メニューが閉じている間は何も描画しない。 */
export function ChatSongPicker() {
  const { state, actions, meta } = useChat();
  const { menuOpen, searchQuery, keyboardOpen, songs, songsLoading, highlightedIndex } = state;
  const [maxHeight, setMaxHeight] = useState<number>(chatPopover.maxHeight);
  const listRef = useRef<HTMLDivElement | null>(null);
  const collisionPadding = keyboardOpen
    ? chatPopover.collisionPaddingCompact
    : chatPopover.collisionPadding;

  // 入力欄より上の空き高さ全体を使えるようにし、PC のみ上限を chatPopover.maxHeight に抑える。
  useLayoutEffect(() => {
    const composerEl = meta.composerRef.current;
    if (!menuOpen || !composerEl) {
      return;
    }

    let rafId = 0;
    const shellEl = composerEl.closest("[data-chat-shell]");
    const compactMedia = window.matchMedia("(max-width: 540px)");

    const updateMaxHeight = () => {
      const rect = composerEl.getBoundingClientRect();
      const topBoundary = shellEl ? shellEl.getBoundingClientRect().top : 0;
      const available = Math.floor(
        rect.top - topBoundary - chatPopover.sideOffset - collisionPadding,
      );
      const maxCap = compactMedia.matches ? available : chatPopover.maxHeight;
      const next = Math.max(chatPopover.minHeight, Math.min(maxCap, available));
      setMaxHeight((prev) => (prev === next ? prev : next));
    };

    const scheduleUpdate = () => {
      updateMaxHeight();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateMaxHeight);
    };

    updateMaxHeight();

    const vv = window.visualViewport;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleUpdate) : null;
    ro?.observe(composerEl);
    if (shellEl) {
      ro?.observe(shellEl);
    }
    vv?.addEventListener("resize", scheduleUpdate);
    vv?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      vv?.removeEventListener("resize", scheduleUpdate);
      vv?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [collisionPadding, meta.composerRef, menuOpen]);

  // コンポーザーの外側を押したら閉じる。
  useEffect(() => {
    const composerEl = meta.composerRef.current;
    if (!menuOpen || !composerEl) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !composerEl.contains(event.target)) {
        actions.dismissSongSearch();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [actions, meta.composerRef, menuOpen]);

  useEffect(() => {
    const item = listRef.current?.children[highlightedIndex];
    if (item instanceof HTMLElement) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  if (!menuOpen) {
    return null;
  }

  return (
    <div
      id={meta.pickerId}
      aria-label="曲の検索候補"
      {...props(styles.triggerPopover, styles.triggerPopoverMaxHeight(maxHeight))}
    >
      <div role="status" aria-live="polite" {...props(styles.triggerStatus)}>
        {songsLoading
          ? "曲を検索中…"
          : songs.length > 0
            ? `${songs.length} 件の曲`
            : state.selectedSong
              ? "曲名やアーティスト名を入力して絞り込む"
              : "まずは曲を検索して選択してください"}
      </div>

      {!songsLoading && songs.length === 0 ? (
        <div {...props(styles.triggerEmpty)}>
          {!searchQuery
            ? "曲名やアーティスト名を入力してください"
            : `「${searchQuery}」に一致する曲が見つかりません`}
        </div>
      ) : null}

      {songs.length > 0 ? (
        <div ref={listRef} {...props(styles.triggerList)}>
          {songs.map((song, index) => {
            const { name, artistName, artwork, isrc } = song.attributes;
            const disabled = !isrc;
            return (
              <button
                key={song.id}
                type="button"
                disabled={disabled}
                {...props(
                  styles.triggerItem,
                  index === highlightedIndex && styles.triggerItemHighlighted,
                  disabled && styles.triggerItemDisabled,
                )}
                onMouseEnter={() => actions.highlightSong(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => actions.selectSong(song)}
              >
                <span {...props(styles.triggerItemIcon)} aria-hidden="true">
                  {artwork ? (
                    <img
                      src={artworkUrl(artwork.url, 72)}
                      alt=""
                      width={36}
                      height={36}
                      {...props(styles.triggerArt)}
                    />
                  ) : (
                    <span {...props(styles.triggerArt, styles.artFallback)}>
                      <MusicNoteIcon />
                    </span>
                  )}
                </span>
                <span {...props(styles.triggerItemText)}>
                  <span {...props(styles.triggerItemTitle)}>{name}</span>
                  <span {...props(styles.triggerItemSub)}>{artistName}</span>
                </span>
                {disabled ? <span {...props(styles.triggerBadge)}>選択不可</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {keyboardOpen && songs.length > 0 ? (
        <div {...props(styles.triggerFooter)}>
          <Button
            type="button"
            {...props(styles.expandResultsBtn)}
            aria-label="キーボードを閉じて検索結果を広く表示する"
            onClick={() => meta.textareaRef.current?.blur()}
          >
            検索結果を広く表示
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const styles = create({
  artFallback: {
    display: "grid",
    placeItems: "center",
    color: t.muted,
    backgroundColor: t.hover,
  },
  triggerPopover: {
    position: "absolute",
    bottom: `calc(100% + ${chatPopover.sideOffset}px)`,
    left: 0,
    zIndex: 50,
    display: "flex",
    flexDirection: "column",
    gap: {
      default: 6,
      [chatMedia.compact]: 2,
    },
    width: {
      default: "min(500px, calc(100vw - 32px))",
      [chatMedia.compact]: "100%",
    },
    maxHeight: chatPopover.maxHeight,
    padding: {
      default: 8,
      [chatMedia.compact]: 6,
    },
    overflow: "hidden",
    color: t.text,
    colorScheme: "light dark",
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: {
      default: 16,
      [chatMedia.compact]: 14,
    },
    boxShadow: t.shadow,
  },
  triggerPopoverMaxHeight: (maxHeight: number) => ({
    maxHeight,
  }),
  triggerStatus: {
    flexShrink: 0,
    paddingBlock: {
      default: 4,
      [chatMedia.compact]: 2,
    },
    paddingInline: {
      default: 12,
      [chatMedia.compact]: 8,
    },
    fontSize: {
      default: 12,
      [chatMedia.compact]: 11,
    },
    color: t.muted,
  },
  triggerFooter: {
    flexShrink: 0,
    paddingTop: 6,
    borderTopColor: t.border,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  expandResultsBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 36,
    paddingBlock: 6,
    paddingInline: 12,
    fontSize: 13,
    fontWeight: 500,
    color: t.text,
    cursor: "pointer",
    backgroundColor: {
      default: t.surface,
      ":hover": {
        default: t.surface,
        [chatMedia.hover]: t.hover,
      },
      ":active": t.hover,
    },
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 10,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.98)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 150ms ${motion.easeOut}, background-color 120ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease",
    },
  },
  triggerEmpty: {
    paddingBlock: {
      default: 20,
      [chatMedia.compact]: 12,
    },
    paddingInline: {
      default: 12,
      [chatMedia.compact]: 10,
    },
    fontSize: {
      default: 13,
      [chatMedia.compact]: 12,
    },
    color: t.muted,
    textAlign: "center",
  },
  triggerList: {
    display: "flex",
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: "column",
    gap: {
      default: 8,
      [chatMedia.compact]: 2,
    },
    minHeight: 0,
    padding: {
      default: 4,
      [chatMedia.compact]: 2,
    },
    overflowY: "auto",
    overscrollBehaviorY: "contain",
  },
  triggerItem: {
    display: "flex",
    flexShrink: 0,
    gap: {
      default: 12,
      [chatMedia.compact]: 10,
    },
    alignItems: "center",
    width: "100%",
    height: "auto",
    minHeight: {
      default: 56,
      [chatMedia.compact]: 44,
    },
    paddingBlock: {
      default: 10,
      [chatMedia.compact]: 6,
    },
    paddingInline: {
      default: 12,
      [chatMedia.compact]: 8,
    },
    fontFamily: "inherit",
    color: "inherit",
    textAlign: "left",
    cursor: "pointer",
    userSelect: "none",
    backgroundColor: {
      default: "transparent",
      ":active": t.highlight,
    },
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: {
      default: 12,
      [chatMedia.compact]: 10,
    },
    transition: `background-color 100ms ${motion.easeOut}`,
  },
  triggerItemHighlighted: {
    backgroundColor: t.highlight,
  },
  triggerItemDisabled: {
    cursor: "not-allowed",
    opacity: 0.48,
  },
  triggerItemIcon: {
    display: "flex",
    flexShrink: 0,
  },
  triggerArt: {
    width: {
      default: 36,
      [chatMedia.compact]: 32,
    },
    height: {
      default: 36,
      [chatMedia.compact]: 32,
    },
    objectFit: "cover",
    borderRadius: {
      default: 7,
      [chatMedia.compact]: 6,
    },
  },
  triggerItemText: {
    display: "flex",
    flex: "1",
    flexDirection: "column",
    gap: {
      default: 2,
      [chatMedia.compact]: 1,
    },
    minWidth: 0,
  },
  triggerItemTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: {
      default: 14,
      [chatMedia.compact]: 13,
    },
    fontWeight: 500,
    lineHeight: {
      default: null,
      [chatMedia.compact]: 1.3,
    },
    whiteSpace: "nowrap",
  },
  triggerItemSub: {
    flexShrink: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: {
      default: 12,
      [chatMedia.compact]: 11,
    },
    lineHeight: {
      default: null,
      [chatMedia.compact]: 1.3,
    },
    color: t.muted,
    whiteSpace: "nowrap",
  },
  triggerBadge: {
    flexShrink: 0,
    paddingBlock: 2,
    paddingInline: 6,
    fontSize: 11,
    color: t.muted,
    backgroundColor: t.hover,
    borderRadius: 6,
  },
});
