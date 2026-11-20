import * as stylex from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import {
  type TriggerDefinition,
  type TriggerMenuDataItem,
  TriggerMenu,
  TriggerMenuContent,
  TriggerMenuEmpty,
  TriggerMenuInput,
  TriggerMenuItem,
  TriggerMenuItemIcon,
  TriggerMenuList,
  TriggerMenuStatus,
} from "@ui-sdk/react/trigger-menu";
import { useEffect, useMemo, useRef, useState } from "react";
import { type AppleSong, artworkUrl, searchSongs } from "#/lib/musickit";
import { usePreviewPlayer } from "#/songs/preview-player";
import { useChat } from "./ChatContext";
import { ArrowUpIcon, CloseIcon, MusicNoteIcon, PauseIcon, PlayIcon, PlusIcon } from "./icons";
import { chatTokens as t } from "./tokens.stylex";

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const songCacheRef = useRef(new Map<string, AppleSong>());

  useEffect(() => {
    if (state.draft === "" && textareaRef.current && textareaRef.current.value !== "") {
      textareaRef.current.value = "";
    }
  }, [state.draft]);

  const triggers = useMemo<TriggerDefinition<string>[]>(() => {
    const loadSongs = async (query: string, { signal }: { signal: AbortSignal }) => {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const songs = await new Promise<AppleSong[]>((resolve, reject) => {
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        const onAbort = () => reject(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
        searchSongs(trimmed)
          .then((result) => {
            signal.removeEventListener("abort", onAbort);
            resolve(result);
          })
          .catch((error: unknown) => {
            signal.removeEventListener("abort", onAbort);
            reject(error);
          });
      });

      const items: TriggerMenuDataItem<string>[] = [];
      for (const song of songs) {
        songCacheRef.current.set(song.id, song);
        items.push({
          value: song.id,
          label: `${song.attributes.name} ${song.attributes.artistName}`,
          disabled: !song.attributes.isrc,
        });
      }
      return items;
    };

    const insertEmpty = () => "";

    return [
      {
        char: "@",
        boundary: "start",
        spaces: 4,
        maxLength: 60,
        items: loadSongs,
        insert: insertEmpty,
      },
      {
        char: "/",
        boundary: "start",
        spaces: 4,
        maxLength: 60,
        items: loadSongs,
        insert: insertEmpty,
      },
    ];
  }, []);

  const overLimit = state.length > meta.maxLength;
  const composerProps = stylex.props(styles.composer);
  const itemProps = stylex.props(styles.triggerItem);

  return (
    <div {...stylex.props(styles.dock, keyboardOpen && styles.dockKeyboardOpen)}>
      <form
        ref={setComposerEl}
        {...composerProps}
        className={`chat-composer ${composerProps.className ?? ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          actions.submit();
        }}
      >
        {state.selectedSong ? <SongAttachmentChip song={state.selectedSong} /> : null}

        <TriggerMenu
          controller={meta.menuController}
          triggers={triggers}
          autoHighlight
          onOpenChange={(next) => actions.setMenuOpen(next)}
          onSelect={(songId, details) => {
            const song = songCacheRef.current.get(songId);
            if (!song) return;
            details.preventDefault();
            // 選択した曲を添付チップへ移すため、入力中の @query / /query を空文字に置き換える。
            details.insert("");
            actions.selectSong(song);
          }}
        >
          <TriggerMenuInput
            ref={textareaRef}
            {...stylex.props(styles.textarea)}
            aria-label="曲への感想を入力（@ または / で曲を検索）"
            placeholder={
              state.selectedSong
                ? "この曲への感想を書く…（Enter で送信、Shift+Enter で改行）"
                : "@ または / に続けて曲名・アーティスト名で検索し、感想を書く…"
            }
            rows={2}
            onInput={(event) => actions.updateDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                !state.menuOpen
              ) {
                event.preventDefault();
                if (state.canSubmit) actions.submit();
              }
            }}
          />

          <div data-slot="visually-hidden">
            <TriggerMenuStatus />
          </div>

          <TriggerMenuContent
            {...stylex.props(styles.triggerPopover)}
            side="top"
            align="start"
            sideOffset={10}
            collisionPadding={16}
            anchor={composerEl}
          >
            <TriggerMenuStatus {...stylex.props(styles.triggerStatus)}>
              {(menuState) => {
                if (menuState.loading) return "曲を検索中…";
                if (menuState.count > 0) return `${menuState.count} 件の曲`;
                return "曲名やアーティスト名を入力して絞り込む";
              }}
            </TriggerMenuStatus>

            <TriggerMenuEmpty {...stylex.props(styles.triggerEmpty)}>
              {(menuState) => {
                if (menuState.loading) return null;
                if (!menuState.query.trim()) return "曲名やアーティスト名を入力してください";
                return `「${menuState.query}」に一致する曲が見つかりません`;
              }}
            </TriggerMenuEmpty>

            <TriggerMenuList {...stylex.props(styles.triggerList)}>
              {(menuState) =>
                (menuState.items as TriggerMenuDataItem<string>[]).map((item) => {
                  const song = songCacheRef.current.get(item.value);
                  if (!song) return null;
                  const { name, artistName, artwork, isrc } = song.attributes;
                  return (
                    <TriggerMenuItem
                      key={song.id}
                      value={song.id}
                      label={item.label}
                      disabled={!isrc}
                      {...itemProps}
                      className={`chat-trigger-item ${itemProps.className ?? ""}`}
                    >
                      <TriggerMenuItemIcon {...stylex.props(styles.triggerItemIcon)}>
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
                      </TriggerMenuItemIcon>
                      <span {...stylex.props(styles.triggerItemText)}>
                        <span {...stylex.props(styles.triggerItemTitle)}>{name}</span>
                        <span {...stylex.props(styles.triggerItemSub)}>{artistName}</span>
                      </span>
                      {!isrc ? <span {...stylex.props(styles.triggerBadge)}>選択不可</span> : null}
                    </TriggerMenuItem>
                  );
                })
              }
            </TriggerMenuList>
          </TriggerMenuContent>
        </TriggerMenu>

        <div {...stylex.props(styles.toolbar)}>
          <div {...stylex.props(styles.tools)}>
            <Button
              type="button"
              {...stylex.props(styles.toolBtn)}
              aria-label="曲を検索して添付"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void meta.menuController.open({ trigger: "@" })}
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
              {...stylex.props(styles.sendBtn)}
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

const styles = stylex.create({
  dock: {
    position: "relative",
    zIndex: 20,
    flexShrink: 0,
    width: "min(100%, 760px)",
    paddingTop: 8,
    paddingRight: 16,
    paddingBottom: "max(20px, env(safe-area-inset-bottom))",
    paddingLeft: 16,
    marginBlock: 0,
    marginInline: "auto",
    backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${t.bg} 0%, transparent), ${t.bg} 28%)`,
  },
  dockKeyboardOpen: {
    paddingBottom: 12,
  },
  composer: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 12,
    paddingRight: 14,
    paddingBottom: 10,
    paddingLeft: 14,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 22,
    boxShadow: t.shadow,
    transition: "border-color 0.15s ease",
  },
  attachment: {
    display: "inline-flex",
    gap: 10,
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingBlock: 6,
    paddingInline: 8,
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 12,
  },
  attachmentArt: {
    flexShrink: 0,
    width: 36,
    height: 36,
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
      ":hover": t.text,
    },
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": t.hover,
    },
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 9999,
  },
  textarea: {
    width: "100%",
    minHeight: 48,
    maxHeight: 200,
    paddingBlock: 4,
    paddingInline: 2,
    fontFamily: "inherit",
    fontSize: {
      default: 15,
      "@media (pointer: coarse)": 16,
    },
    lineHeight: 1.55,
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
    gap: 6,
    alignItems: "center",
    height: 32,
    paddingBlock: 0,
    paddingInline: 11,
    fontSize: 13,
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
    borderRadius: 9999,
  },
  submitGroup: {
    display: "flex",
    gap: 10,
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
    width: 34,
    height: 34,
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
    transform: {
      default: null,
      ":active:not(:disabled)": "scale(0.95)",
    },
    transition: "opacity 0.15s ease, transform 0.1s ease",
  },
  triggerPopover: {
    zIndex: 50,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "min(500px, calc(100vw - 32px))",
    maxHeight: 420,
    padding: 8,
    overflow: "hidden",
    color: t.text,
    colorScheme: "light dark",
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 16,
    boxShadow: t.shadow,
  },
  triggerStatus: {
    paddingBlock: 4,
    paddingInline: 12,
    fontSize: 12,
    color: t.muted,
  },
  triggerEmpty: {
    paddingBlock: 20,
    paddingInline: 12,
    fontSize: 13,
    color: t.muted,
    textAlign: "center",
  },
  triggerList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 360,
    padding: 4,
    overflowY: "auto",
  },
  triggerItem: {
    display: "flex",
    flexShrink: 0,
    gap: 12,
    alignItems: "center",
    height: "auto",
    minHeight: 56,
    paddingBlock: 10,
    paddingInline: 12,
    cursor: "pointer",
    userSelect: "none",
    borderRadius: 12,
  },
  triggerItemIcon: {
    display: "flex",
    flexShrink: 0,
  },
  triggerArt: {
    width: 36,
    height: 36,
    objectFit: "cover",
    borderRadius: 7,
  },
  triggerItemText: {
    display: "flex",
    flex: "1",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  triggerItemTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 14,
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  triggerItemSub: {
    flexShrink: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 12,
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
