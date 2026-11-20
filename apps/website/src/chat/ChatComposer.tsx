import * as stylex from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import { useEffect, useId, useRef, useState } from "react";
import { type AppleSong, artworkUrl, searchSongs } from "#/lib/musickit";
import { motion } from "#/motion.stylex";
import { usePreviewPlayer } from "#/songs/preview-player";
import { useChat } from "./ChatContext";
import { ArrowUpIcon, CloseIcon, MusicNoteIcon, PauseIcon, PlayIcon, PlusIcon } from "./icons";
import { chatMedia, chatPopover, chatTokens as t } from "./tokens.stylex";

function SongAttachmentChip({ song }: { song: AppleSong }) {
  const { actions } = useChat();
  const preview = usePreviewPlayer();
  const playing = preview.state.playingId === song.id;
  const { name, artistName, artwork, previews } = song.attributes;

  return (
    <div {...stylex.props(styles.attachment)}>
      {artwork ? (
        <img
          {...stylex.props(styles.attachmentArt)}
          src={artworkUrl(artwork.url, 80)}
          alt=""
          width={36}
          height={36}
        />
      ) : (
        <div {...stylex.props(styles.attachmentArt, styles.artFallback)} aria-hidden="true">
          <MusicNoteIcon />
        </div>
      )}
      <div {...stylex.props(styles.attachmentMeta)}>
        <span {...stylex.props(styles.attachmentTitle)}>{name}</span>
        <span {...stylex.props(styles.attachmentArtist)}>{artistName}</span>
      </div>
      {previews?.length ? (
        <Button
          type="button"
          {...stylex.props(styles.iconBtn)}
          aria-label={playing ? `${name} の試聴を停止` : `${name} を試聴`}
          onClick={() => preview.actions.toggle(song)}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
      ) : null}
      <Button
        type="button"
        {...stylex.props(styles.iconBtn)}
        aria-label={`${name} の選択を解除`}
        onClick={actions.clearSong}
      >
        <CloseIcon />
      </Button>
    </div>
  );
}

export function ChatComposer({ keyboardOpen = false }: { keyboardOpen?: boolean }) {
  const { state, actions, meta } = useChat();
  const [composerEl, setComposerEl] = useState<HTMLFormElement | null>(null);
  const [popoverMaxHeight, setPopoverMaxHeight] = useState<number>(chatPopover.maxHeight);
  const [songs, setSongs] = useState<AppleSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const collisionPadding = keyboardOpen
    ? chatPopover.collisionPaddingCompact
    : chatPopover.collisionPadding;

  const { menuOpen, searchQuery } = state;

  useEffect(() => {
    if (!menuOpen || !searchQuery) {
      setSongs([]);
      setLoading(false);
      setHighlightedIndex(0);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(() => {
      searchSongs(searchQuery)
        .then((result) => {
          if (cancelled) return;
          setSongs(result);
          setHighlightedIndex(0);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setSongs([]);
          setLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [menuOpen, searchQuery]);

  // 入力欄より上の空き高さ全体を使えるようにし、PC のみ上限を chatPopover.maxHeight に抑える。
  useEffect(() => {
    if (!composerEl) return;

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
      setPopoverMaxHeight((prev) => (prev === next ? prev : next));
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
    if (shellEl) ro?.observe(shellEl);
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
  }, [collisionPadding, composerEl, keyboardOpen, menuOpen]);

  useEffect(() => {
    if (!menuOpen || !composerEl) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !composerEl.contains(event.target)) {
        actions.dismissSongSearch();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [actions, composerEl, menuOpen]);

  useEffect(() => {
    const item = listRef.current?.children[highlightedIndex];
    if (item instanceof HTMLElement) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const selectSongItem = (song: AppleSong) => {
    if (!song.attributes.isrc) return;
    actions.selectSong(song);
  };

  const overLimit = state.length > meta.maxLength;

  return (
    <div {...stylex.props(styles.dock, keyboardOpen && styles.dockKeyboardOpen)}>
      <form
        ref={setComposerEl}
        data-chat-composer=""
        {...stylex.props(styles.composer)}
        onSubmit={(event) => {
          event.preventDefault();
          actions.submit();
        }}
      >
        {menuOpen ? (
          <div
            id={listId}
            aria-label="曲の検索候補"
            {...stylex.props(
              styles.triggerPopover,
              styles.triggerPopoverMaxHeight(popoverMaxHeight),
            )}
          >
            <div role="status" aria-live="polite" {...stylex.props(styles.triggerStatus)}>
              {loading
                ? "曲を検索中…"
                : songs.length > 0
                  ? `${songs.length} 件の曲`
                  : "曲名やアーティスト名を入力して絞り込む"}
            </div>

            {!loading && songs.length === 0 ? (
              <div {...stylex.props(styles.triggerEmpty)}>
                {!searchQuery
                  ? "曲名やアーティスト名を入力してください"
                  : `「${searchQuery}」に一致する曲が見つかりません`}
              </div>
            ) : null}

            {songs.length > 0 ? (
              <div ref={listRef} {...stylex.props(styles.triggerList)}>
                {songs.map((song, index) => {
                  const { name, artistName, artwork, isrc } = song.attributes;
                  const highlighted = index === highlightedIndex;
                  const disabled = !isrc;
                  return (
                    <button
                      key={song.id}
                      type="button"
                      disabled={disabled}
                      {...stylex.props(
                        styles.triggerItem,
                        highlighted && styles.triggerItemHighlighted,
                        disabled && styles.triggerItemDisabled,
                      )}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectSongItem(song)}
                    >
                      <span {...stylex.props(styles.triggerItemIcon)} aria-hidden="true">
                        {artwork ? (
                          <img
                            src={artworkUrl(artwork.url, 72)}
                            alt=""
                            width={36}
                            height={36}
                            {...stylex.props(styles.triggerArt)}
                          />
                        ) : (
                          <span {...stylex.props(styles.triggerArt, styles.artFallback)}>
                            <MusicNoteIcon />
                          </span>
                        )}
                      </span>
                      <span {...stylex.props(styles.triggerItemText)}>
                        <span {...stylex.props(styles.triggerItemTitle)}>{name}</span>
                        <span {...stylex.props(styles.triggerItemSub)}>{artistName}</span>
                      </span>
                      {disabled ? (
                        <span {...stylex.props(styles.triggerBadge)}>選択不可</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {keyboardOpen && songs.length > 0 ? (
              <div {...stylex.props(styles.triggerFooter)}>
                <Button
                  type="button"
                  {...stylex.props(styles.expandResultsBtn)}
                  aria-label="キーボードを閉じて検索結果を広く表示する"
                  onClick={() => meta.textareaRef.current?.blur()}
                >
                  検索結果を広く表示
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {state.selectedSong ? <SongAttachmentChip song={state.selectedSong} /> : null}

        <textarea
          ref={meta.textareaRef}
          {...stylex.props(styles.textarea)}
          aria-label="曲への感想を入力（@ または / で曲を検索）"
          aria-controls={menuOpen ? listId : undefined}
          placeholder={
            state.selectedSong
              ? "この曲への感想を書く…（Enter で送信、Shift+Enter で改行）"
              : "@ または / に続けて曲名・アーティスト名で検索し、感想を書く…"
          }
          rows={1}
          value={state.draft}
          onChange={(event) => actions.updateDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (menuOpen) {
              if (event.key === "Escape") {
                event.preventDefault();
                actions.dismissSongSearch();
                return;
              }
              if (event.key === "ArrowDown" && songs.length > 0) {
                event.preventDefault();
                setHighlightedIndex((prev) => (prev + 1) % songs.length);
                return;
              }
              if (event.key === "ArrowUp" && songs.length > 0) {
                event.preventDefault();
                setHighlightedIndex((prev) => (prev - 1 + songs.length) % songs.length);
                return;
              }
              if (
                (event.key === "Enter" || event.key === "Tab") &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                songs.length > 0
              ) {
                const target = songs[highlightedIndex];
                if (target?.attributes.isrc) {
                  event.preventDefault();
                  selectSongItem(target);
                }
                return;
              }
            }

            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              !menuOpen
            ) {
              event.preventDefault();
              if (state.canSubmit) actions.submit();
            }
          }}
        />

        <div {...stylex.props(styles.toolbar)}>
          <div {...stylex.props(styles.tools)}>
            <Button
              type="button"
              {...stylex.props(styles.toolBtn)}
              aria-label="曲を検索して添付"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => actions.openSongSearch("@")}
            >
              <PlusIcon />
              <span>曲を選ぶ</span>
            </Button>
          </div>

          <div {...stylex.props(styles.submitGroup)}>
            <span {...stylex.props(styles.counter, overLimit && styles.counterOver)}>
              {state.length} / {meta.maxLength}
            </span>
            <Button
              type="submit"
              {...stylex.props(styles.sendBtn, state.canSubmit && styles.sendBtnEnabled)}
              aria-label="感想を送信"
              disabled={!state.canSubmit}
            >
              <ArrowUpIcon />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

const chipEnter = stylex.keyframes({
  from: {
    opacity: 0,
    transform: "scale(0.96) translateY(4px)",
  },
  to: {
    opacity: 1,
    transform: "scale(1) translateY(0)",
  },
});

const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const styles = stylex.create({
  dock: {
    position: "relative",
    zIndex: 20,
    flexShrink: 0,
    width: "min(100%, 760px)",
    paddingTop: {
      default: 8,
      [chatMedia.compact]: 4,
    },
    paddingRight: {
      default: 16,
      [chatMedia.compact]: 12,
    },
    paddingBottom: {
      default: "max(20px, env(safe-area-inset-bottom))",
      [chatMedia.compact]: "max(12px, env(safe-area-inset-bottom))",
    },
    paddingLeft: {
      default: 16,
      [chatMedia.compact]: 12,
    },
    marginBlock: 0,
    marginInline: "auto",
    backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${t.bg} 0%, transparent), ${t.bg} 28%)`,
  },
  dockKeyboardOpen: {
    paddingBottom: {
      default: 12,
      [chatMedia.compact]: 8,
    },
  },
  composer: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: {
      default: 8,
      [chatMedia.compact]: 4,
    },
    paddingTop: {
      default: 12,
      [chatMedia.compact]: 8,
    },
    paddingRight: {
      default: 14,
      [chatMedia.compact]: 10,
    },
    paddingBottom: {
      default: 10,
      [chatMedia.compact]: 8,
    },
    paddingLeft: {
      default: 14,
      [chatMedia.compact]: 12,
    },
    backgroundColor: t.surface,
    borderColor: {
      default: t.border,
      ":focus-within": t.borderStrong,
    },
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: {
      default: 22,
      [chatMedia.compact]: 18,
    },
    boxShadow: t.shadow,
    transition: "border-color 0.15s ease",
  },
  attachment: {
    display: "inline-flex",
    gap: {
      default: 10,
      [chatMedia.compact]: 8,
    },
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingBlock: {
      default: 6,
      [chatMedia.compact]: 4,
    },
    paddingInline: {
      default: 8,
      [chatMedia.compact]: 6,
    },
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 12,
    transformOrigin: "left bottom",
    animationName: {
      default: chipEnter,
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
  attachmentArt: {
    flexShrink: 0,
    width: {
      default: 36,
      [chatMedia.compact]: 30,
    },
    height: {
      default: 36,
      [chatMedia.compact]: 30,
    },
    objectFit: "cover",
    borderRadius: 7,
  },
  attachmentMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    minWidth: 0,
  },
  attachmentTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  attachmentArtist: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 12,
    color: t.muted,
    whiteSpace: "nowrap",
  },
  artFallback: {
    display: "grid",
    placeItems: "center",
    color: t.muted,
    backgroundColor: t.hover,
  },
  iconBtn: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 28,
    height: 28,
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
    borderRadius: 9999,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 160ms ${motion.easeOut}, background-color 150ms ${motion.easeOut}, color 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease, color 120ms ease",
    },
  },
  textarea: {
    width: "100%",
    minHeight: {
      default: 55,
      [chatMedia.compact]: 30,
    },
    maxHeight: {
      default: 200,
      [chatMedia.compact]: 112,
    },
    paddingBlock: {
      default: 4,
      [chatMedia.compact]: 2,
    },
    paddingInline: 2,
    fontFamily: "inherit",
    fontSize: {
      default: 15,
      [chatMedia.touch]: 16,
    },
    lineHeight: {
      default: 1.55,
      [chatMedia.compact]: 1.45,
    },
    color: t.text,
    resize: "none",
    outline: {
      default: "none",
      ":focus-visible": "none",
      ":focus": "none",
    },
    backgroundColor: "transparent",
    borderStyle: "none",
    borderWidth: 0,
    boxShadow: "none",
  },
  toolbar: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  tools: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },
  toolBtn: {
    display: "inline-flex",
    gap: {
      default: 6,
      [chatMedia.compact]: 4,
    },
    alignItems: "center",
    height: {
      default: 32,
      [chatMedia.compact]: 30,
    },
    paddingBlock: 0,
    paddingInline: {
      default: 11,
      [chatMedia.compact]: 10,
    },
    fontSize: {
      default: 13,
      [chatMedia.compact]: 12,
    },
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
    borderRadius: 9999,
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
  submitGroup: {
    display: "flex",
    gap: {
      default: 10,
      [chatMedia.compact]: 8,
    },
    alignItems: "center",
  },
  counter: {
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    color: t.muted,
  },
  counterOver: {
    fontWeight: 600,
    color: t.danger,
  },
  sendBtn: {
    display: "grid",
    placeItems: "center",
    width: {
      default: 34,
      [chatMedia.compact]: 30,
    },
    height: {
      default: 34,
      [chatMedia.compact]: 30,
    },
    padding: 0,
    color: t.primaryFg,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    backgroundColor: t.primary,
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 9999,
    opacity: {
      default: 1,
      ":disabled": 0.35,
    },
    transition: {
      default: `opacity 150ms ${motion.easeOut}, transform 160ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "opacity 120ms ease",
    },
  },
  sendBtnEnabled: {
    transform: {
      default: null,
      ":active": {
        default: "scale(0.95)",
        [chatMedia.reducedMotion]: "none",
      },
    },
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
      ":hover": t.hover,
    },
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 10,
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
    backgroundColor: "transparent",
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: {
      default: 12,
      [chatMedia.compact]: 10,
    },
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
