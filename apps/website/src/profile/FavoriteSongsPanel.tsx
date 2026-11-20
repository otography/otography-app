import * as stylex from "@stylexjs/stylex";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog";
import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { useEffect, useState } from "react";
import { CloseIcon, MusicNoteIcon, PauseIcon, PlayIcon, PlusIcon } from "#/chat/icons";
import { chatMedia, chatTokens as t } from "#/chat/tokens.stylex";
import { type AppleSong, artworkUrl, searchSongs } from "#/lib/musickit";
import type { FavoriteDecoration, FavoriteSongItem } from "#/lib/profile";
import { motion } from "#/motion.stylex";
import { usePreviewPlayer } from "#/songs/preview-player";
import { FavoriteDecorationFields, validateDecoration } from "./FavoriteDecorationEditor";
import { ChevronDownIcon, ChevronUpIcon, EditIcon, SearchIcon, TrashIcon } from "./icons";
import { useProfile } from "./ProfileContext";
import { favoriteAccentStyles } from "./favorite-colors";

const EMPTY_DECORATION: FavoriteDecoration = { comment: null, emoji: null, color: null };

function AddFavoriteSongDialog() {
  const { state, actions, meta } = useProfile();
  const preview = usePreviewPlayer();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AppleSong[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AppleSong | null>(null);
  const [decoration, setDecoration] = useState<FavoriteDecoration>(EMPTY_DECORATION);

  const atLimit = state.favoriteSongs.length >= meta.favoriteLimit;
  const existingIsrcs = new Set(state.favoriteSongs.map((item) => item.song.isrc.toUpperCase()));

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    setSearching(true);
    setSearchError(null);

    const timer = window.setTimeout(() => {
      searchSongs(query.trim())
        .then((songs) => {
          if (cancelled) return;
          setResults(songs);
          setSearching(false);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setResults([]);
          setSearching(false);
          setSearchError(error instanceof Error ? error.message : "検索に失敗しました");
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setDecoration(EMPTY_DECORATION);
      setSearchError(null);
    }
    setOpen(next);
  };

  const { emojiError, commentError } = validateDecoration(decoration);
  const canSave =
    Boolean(selected?.attributes.isrc) && !emojiError && !commentError && !state.isSavingSongs;

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !canSave) return;
    try {
      await actions.addFavoriteSong(selected, {
        comment: decoration.comment?.trim() || null,
        emoji: decoration.emoji?.trim() || null,
        color: decoration.color,
      });
      handleOpenChange(false);
    } catch {
      // エラー通知は Provider 側の toast で行う。
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger disabled={atLimit} {...stylex.props(styles.addBtn)}>
        <PlusIcon />
        <span>好きな曲を追加</span>
      </DialogTrigger>
      <DialogBackdrop {...stylex.props(styles.backdrop)} />
      <DialogContent {...stylex.props(styles.dialog)}>
        <div {...stylex.props(styles.dialogHeader)}>
          <div {...stylex.props(styles.dialogHeading)}>
            <DialogTitle {...stylex.props(styles.dialogTitle)}>好きな曲を追加</DialogTitle>
            <DialogDescription {...stylex.props(styles.dialogDesc)}>
              Apple Music から曲を検索して、最大 {meta.favoriteLimit} 曲まで登録できます。
            </DialogDescription>
          </div>
          <DialogClose aria-label="閉じる" {...stylex.props(styles.closeBtn)}>
            <CloseIcon />
          </DialogClose>
        </div>

        <form {...stylex.props(styles.form)} onSubmit={(event) => void handleSave(event)}>
          {selected ? (
            <div {...stylex.props(styles.selectedBox)}>
              {selected.attributes.artwork ? (
                <img
                  src={artworkUrl(selected.attributes.artwork.url, 96)}
                  alt=""
                  width={44}
                  height={44}
                  {...stylex.props(styles.art)}
                />
              ) : (
                <div {...stylex.props(styles.art, styles.artFallback)} aria-hidden="true">
                  <MusicNoteIcon />
                </div>
              )}
              <div {...stylex.props(styles.meta)}>
                <span {...stylex.props(styles.title)}>{selected.attributes.name}</span>
                <span {...stylex.props(styles.sub)}>{selected.attributes.artistName}</span>
              </div>
              <Button
                type="button"
                {...stylex.props(styles.secondaryBtnSm)}
                onClick={() => setSelected(null)}
              >
                別の曲を選ぶ
              </Button>
            </div>
          ) : (
            <div {...stylex.props(styles.searchSection)}>
              <Field name="song-search">
                <FieldLabel {...stylex.props(styles.label)}>曲を検索</FieldLabel>
                <div {...stylex.props(styles.searchInputWrap)}>
                  <span {...stylex.props(styles.searchIcon)} aria-hidden="true">
                    <SearchIcon />
                  </span>
                  <Input
                    value={query}
                    onValueChange={setQuery}
                    placeholder="曲名やアーティスト名を入力…"
                    {...stylex.props(styles.searchInput)}
                  />
                </div>
              </Field>

              <div role="status" aria-live="polite" {...stylex.props(styles.searchStatus)}>
                {searching
                  ? "検索中…"
                  : searchError
                    ? searchError
                    : query.trim() && results.length === 0
                      ? "一致する曲が見つかりませんでした"
                      : results.length > 0
                        ? `${results.length} 件の候補`
                        : "キーワードを入力して曲を検索してください"}
              </div>

              {results.length > 0 ? (
                <ul {...stylex.props(styles.resultList)} aria-label="曲の検索結果">
                  {results.map((song) => {
                    const isrc = song.attributes.isrc;
                    const alreadyAdded = Boolean(isrc && existingIsrcs.has(isrc.toUpperCase()));
                    const disabled = !isrc || alreadyAdded;
                    const playing = preview.state.playingId === song.id;
                    return (
                      <li key={song.id} {...stylex.props(styles.resultRow)}>
                        <Button
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelected(song)}
                          {...stylex.props(styles.resultSelectBtn)}
                        >
                          {song.attributes.artwork ? (
                            <img
                              src={artworkUrl(song.attributes.artwork.url, 72)}
                              alt=""
                              width={38}
                              height={38}
                              {...stylex.props(styles.resultArt)}
                            />
                          ) : (
                            <span
                              {...stylex.props(styles.resultArt, styles.artFallback)}
                              aria-hidden="true"
                            >
                              <MusicNoteIcon />
                            </span>
                          )}
                          <span {...stylex.props(styles.meta)}>
                            <span {...stylex.props(styles.title)}>{song.attributes.name}</span>
                            <span {...stylex.props(styles.sub)}>{song.attributes.artistName}</span>
                          </span>
                          {alreadyAdded ? (
                            <span {...stylex.props(styles.badge)}>登録済み</span>
                          ) : !isrc ? (
                            <span {...stylex.props(styles.badge)}>選択不可</span>
                          ) : null}
                        </Button>
                        {song.attributes.previews?.length ? (
                          <Button
                            type="button"
                            aria-label={
                              playing
                                ? `${song.attributes.name} の試聴を停止`
                                : `${song.attributes.name} を試聴`
                            }
                            onClick={() => preview.actions.toggle(song)}
                            {...stylex.props(styles.iconBtn)}
                          >
                            {playing ? <PauseIcon /> : <PlayIcon />}
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          )}

          {selected ? (
            <FavoriteDecorationFields
              value={decoration}
              onChange={setDecoration}
              fieldPrefix="add-song"
            />
          ) : null}

          <div {...stylex.props(styles.dialogFooter)}>
            <DialogClose {...stylex.props(styles.secondaryBtn)}>キャンセル</DialogClose>
            <Button type="submit" disabled={!canSave} {...stylex.props(styles.primaryBtn)}>
              {state.isSavingSongs ? "追加中…" : "リストに追加"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditFavoriteSongDialog({ item }: { item: FavoriteSongItem }) {
  const { state, actions } = useProfile();
  const [open, setOpen] = useState(false);
  const [decoration, setDecoration] = useState<FavoriteDecoration>({
    comment: item.comment,
    emoji: item.emoji,
    color: item.color,
  });

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDecoration({ comment: item.comment, emoji: item.emoji, color: item.color });
    }
    setOpen(next);
  };

  const title = item.song.title ?? "（曲名なし）";
  const { emojiError, commentError } = validateDecoration(decoration);
  const canSave = !emojiError && !commentError && !state.isSavingSongs;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;
    try {
      await actions.updateFavoriteSong(item.song.isrc, {
        comment: decoration.comment?.trim() || null,
        emoji: decoration.emoji?.trim() || null,
        color: decoration.color,
      });
      setOpen(false);
    } catch {
      // エラー通知は Provider 側の toast で行う。
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        aria-label={`「${title}」のメモと飾りを編集`}
        {...stylex.props(styles.iconBtn)}
      >
        <EditIcon />
      </DialogTrigger>
      <DialogBackdrop {...stylex.props(styles.backdrop)} />
      <DialogContent {...stylex.props(styles.dialog)}>
        <div {...stylex.props(styles.dialogHeader)}>
          <div {...stylex.props(styles.dialogHeading)}>
            <DialogTitle {...stylex.props(styles.dialogTitle)}>「{title}」を編集</DialogTitle>
            <DialogDescription {...stylex.props(styles.dialogDesc)}>
              ひとことメモ、絵文字バッジ、アクセントカラーを設定できます。
            </DialogDescription>
          </div>
          <DialogClose aria-label="閉じる" {...stylex.props(styles.closeBtn)}>
            <CloseIcon />
          </DialogClose>
        </div>

        <form {...stylex.props(styles.form)} onSubmit={(event) => void handleSubmit(event)}>
          <FavoriteDecorationFields
            value={decoration}
            onChange={setDecoration}
            fieldPrefix={`edit-song-${item.song.isrc}`}
          />
          <div {...stylex.props(styles.dialogFooter)}>
            <DialogClose {...stylex.props(styles.secondaryBtn)}>キャンセル</DialogClose>
            <Button type="submit" disabled={!canSave} {...stylex.props(styles.primaryBtn)}>
              {state.isSavingSongs ? "保存中…" : "変更を保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FavoriteSongRow({
  item,
  index,
  total,
}: {
  item: FavoriteSongItem;
  index: number;
  total: number;
}) {
  const { state, actions } = useProfile();
  const preview = usePreviewPlayer();
  const title = item.song.title ?? "（曲名なし）";
  const catalogSong =
    state.catalogSongs.byId.get(item.song.appleSongId) ??
    state.catalogSongs.byIsrc.get(item.song.isrc.toUpperCase());
  const playing = catalogSong ? preview.state.playingId === catalogSong.id : false;
  const accentStyle = item.color ? favoriteAccentStyles[item.color] : null;

  return (
    <li {...stylex.props(styles.card, accentStyle)}>
      <div {...stylex.props(styles.cardMain)}>
        <span {...stylex.props(styles.rank)} aria-label={`${index + 1} 番目`}>
          {String(index + 1).padStart(2, "0")}
        </span>

        <div {...stylex.props(styles.artWrap)}>
          {item.song.artworkUrl ? (
            <img
              src={artworkUrl(item.song.artworkUrl, 112)}
              alt=""
              width={52}
              height={52}
              {...stylex.props(styles.cardArt)}
            />
          ) : (
            <div {...stylex.props(styles.cardArt, styles.artFallback)} aria-hidden="true">
              <MusicNoteIcon />
            </div>
          )}
          {item.emoji ? (
            <span {...stylex.props(styles.emojiBadge)} aria-hidden="true">
              {item.emoji}
            </span>
          ) : null}
        </div>

        <div {...stylex.props(styles.meta)}>
          {item.song.url ? (
            <a
              href={item.song.url}
              target="_blank"
              rel="noreferrer"
              {...stylex.props(styles.title, styles.titleLink)}
            >
              {title}
            </a>
          ) : (
            <span {...stylex.props(styles.title)}>{title}</span>
          )}
          {item.song.artistName ? (
            <span {...stylex.props(styles.sub)}>{item.song.artistName}</span>
          ) : null}
        </div>

        <div {...stylex.props(styles.rowActions)}>
          {catalogSong?.attributes.previews?.length ? (
            <Button
              type="button"
              aria-label={playing ? `${title} の試聴を停止` : `${title} を試聴`}
              onClick={() => preview.actions.toggle(catalogSong)}
              {...stylex.props(styles.iconBtn)}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Button>
          ) : null}

          <Button
            type="button"
            disabled={index === 0 || state.isSavingSongs}
            aria-label={`「${title}」を上に移動`}
            onClick={() => void actions.moveFavoriteSong(index, -1)}
            {...stylex.props(styles.iconBtn)}
          >
            <ChevronUpIcon />
          </Button>
          <Button
            type="button"
            disabled={index === total - 1 || state.isSavingSongs}
            aria-label={`「${title}」を下に移動`}
            onClick={() => void actions.moveFavoriteSong(index, 1)}
            {...stylex.props(styles.iconBtn)}
          >
            <ChevronDownIcon />
          </Button>

          <EditFavoriteSongDialog item={item} />

          <AlertDialog pendingAnnouncement="好きな曲から削除しています">
            <AlertDialogTrigger
              disabled={state.isSavingSongs}
              aria-label={`「${title}」を好きな曲から削除`}
              {...stylex.props(styles.deleteBtn)}
            >
              <TrashIcon />
            </AlertDialogTrigger>
            <AlertDialogBackdrop {...stylex.props(styles.backdrop)} />
            <AlertDialogContent {...stylex.props(styles.alertDialog)}>
              <AlertDialogTitle {...stylex.props(styles.dialogTitle)}>
                好きな曲から外しますか？
              </AlertDialogTitle>
              <AlertDialogDescription {...stylex.props(styles.dialogDesc)}>
                「{title}」を好きな曲リストから削除します。
              </AlertDialogDescription>
              <div {...stylex.props(styles.dialogFooter)}>
                <AlertDialogClose {...stylex.props(styles.secondaryBtn)}>
                  キャンセル
                </AlertDialogClose>
                <AlertDialogClose
                  value="confirm"
                  data-agent-confirm={`「${title}」を好きな曲から削除します`}
                  action={() => actions.removeFavoriteSong(item.song.isrc)}
                  {...stylex.props(styles.dangerBtn)}
                >
                  リストから外す
                </AlertDialogClose>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {item.comment ? <p {...stylex.props(styles.comment)}>{item.comment}</p> : null}
    </li>
  );
}

export function FavoriteSongsPanel() {
  const { state, meta } = useProfile();

  return (
    <div {...stylex.props(styles.panel)}>
      <div {...stylex.props(styles.panelBar)}>
        <div {...stylex.props(styles.panelInfo)}>
          <h2 {...stylex.props(styles.panelTitle)}>好きな曲</h2>
          <span {...stylex.props(styles.panelCount)}>
            {state.favoriteSongs.length} / {meta.favoriteLimit}
          </span>
        </div>
        <AddFavoriteSongDialog />
      </div>

      {state.isProfilePending ? (
        <div {...stylex.props(styles.stateBox)} aria-busy="true">
          好きな曲を読み込んでいます…
        </div>
      ) : state.favoriteSongs.length === 0 ? (
        <div {...stylex.props(styles.emptyBox)}>
          <div {...stylex.props(styles.emptyIcon)} aria-hidden="true">
            <MusicNoteIcon />
          </div>
          <p {...stylex.props(styles.emptyTitle)}>まだ好きな曲が登録されていません</p>
          <p {...stylex.props(styles.emptyDesc)}>
            自分を象徴する曲や、いま聴いている曲を最大 {meta.favoriteLimit} 曲まで並べられます。
          </p>
        </div>
      ) : (
        <ol {...stylex.props(styles.list)} aria-label="好きな曲一覧">
          {state.favoriteSongs.map((item, index) => (
            <FavoriteSongRow
              key={item.song.isrc}
              item={item}
              index={index}
              total={state.favoriteSongs.length}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

const styles = stylex.create({
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  panelBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelInfo: {
    display: "flex",
    gap: 8,
    alignItems: "baseline",
  },
  panelTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
  },
  panelCount: {
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    color: t.muted,
  },
  addBtn: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    height: 34,
    paddingBlock: 0,
    paddingInline: 12,
    fontSize: 13,
    fontWeight: 600,
    color: t.primaryFg,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    backgroundColor: t.primary,
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 10,
    opacity: {
      default: 1,
      ":disabled": 0.4,
    },
    transform: {
      default: null,
      ":active": {
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 160ms ${motion.easeOut}, opacity 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "opacity 120ms ease",
    },
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 0,
    margin: 0,
    listStyle: "none",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 14,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 16,
    transition: `border-color 150ms ${motion.easeOut}, background-color 150ms ${motion.easeOut}`,
  },
  cardMain: {
    display: "flex",
    gap: {
      default: 12,
      [chatMedia.compact]: 10,
    },
    alignItems: "center",
  },
  rank: {
    flexShrink: 0,
    width: 22,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color: t.muted,
    textAlign: "center",
  },
  artWrap: {
    position: "relative",
    flexShrink: 0,
    width: 52,
    height: 52,
  },
  cardArt: {
    display: "block",
    width: 52,
    height: 52,
    objectFit: "cover",
    borderRadius: 10,
  },
  emojiBadge: {
    position: "absolute",
    right: -5,
    bottom: -5,
    display: "grid",
    placeItems: "center",
    width: 22,
    height: 22,
    fontSize: 13,
    lineHeight: 1,
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
  },
  art: {
    flexShrink: 0,
    width: 44,
    height: 44,
    objectFit: "cover",
    borderRadius: 8,
  },
  resultArt: {
    flexShrink: 0,
    width: 38,
    height: 38,
    objectFit: "cover",
    borderRadius: 7,
  },
  artFallback: {
    display: "grid",
    placeItems: "center",
    color: t.muted,
    backgroundColor: t.hover,
  },
  meta: {
    display: "flex",
    flex: "1",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
    textAlign: "left",
  },
  title: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 14,
    fontWeight: 600,
    color: t.text,
    whiteSpace: "nowrap",
  },
  titleLink: {
    textDecoration: {
      default: "none",
      ":hover": {
        default: "none",
        [chatMedia.hover]: "underline",
      },
    },
  },
  sub: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 12,
    color: t.muted,
    whiteSpace: "nowrap",
  },
  rowActions: {
    display: "flex",
    flexShrink: 0,
    gap: 2,
    alignItems: "center",
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
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
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
    opacity: {
      default: 1,
      ":disabled": 0.3,
    },
  },
  deleteBtn: {
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
        [chatMedia.hover]: t.danger,
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
  },
  comment: {
    paddingLeft: 34,
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: t.text,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    backdropFilter: "blur(2px)",
  },
  dialog: {
    width: "min(520px, calc(100vw - 24px))",
    maxHeight: "min(84dvh, 720px)",
    padding: 20,
    overflowY: "auto",
    color: t.text,
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 18,
    boxShadow: t.shadow,
  },
  alertDialog: {
    width: "min(420px, calc(100vw - 24px))",
    padding: 20,
    color: t.text,
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 18,
    boxShadow: t.shadow,
  },
  dialogHeader: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dialogHeading: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  dialogTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 600,
  },
  dialogDesc: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.55,
    color: t.muted,
  },
  closeBtn: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 30,
    height: 30,
    padding: 0,
    color: t.muted,
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
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  selectedBox: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: 10,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 12,
  },
  searchSection: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: t.text,
  },
  searchInputWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    display: "grid",
    placeItems: "center",
    color: t.muted,
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    height: 38,
    paddingTop: 0,
    paddingRight: 12,
    paddingBottom: 0,
    paddingLeft: 36,
    fontSize: 14,
    color: t.text,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 10,
  },
  searchStatus: {
    fontSize: 12,
    color: t.muted,
  },
  resultList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxHeight: 260,
    padding: 0,
    margin: 0,
    overflowY: "auto",
    listStyle: "none",
  },
  resultRow: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },
  resultSelectBtn: {
    display: "flex",
    flex: "1",
    gap: 10,
    alignItems: "center",
    minWidth: 0,
    height: "auto",
    paddingBlock: 7,
    paddingInline: 8,
    color: t.text,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    backgroundColor: {
      default: "transparent",
      ":hover": {
        default: "transparent",
        [chatMedia.hover]: t.hover,
      },
    },
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 10,
    opacity: {
      default: 1,
      ":disabled": 0.5,
    },
  },
  badge: {
    flexShrink: 0,
    paddingBlock: 2,
    paddingInline: 7,
    fontSize: 11,
    color: t.muted,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
  },
  dialogFooter: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  secondaryBtn: {
    height: 36,
    paddingBlock: 0,
    paddingInline: 14,
    fontSize: 13,
    fontWeight: 500,
    color: t.text,
    cursor: "pointer",
    backgroundColor: "transparent",
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 10,
  },
  secondaryBtnSm: {
    flexShrink: 0,
    height: 30,
    paddingBlock: 0,
    paddingInline: 10,
    fontSize: 12,
    fontWeight: 500,
    color: t.text,
    cursor: "pointer",
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 8,
  },
  primaryBtn: {
    height: 36,
    paddingBlock: 0,
    paddingInline: 16,
    fontSize: 13,
    fontWeight: 600,
    color: t.primaryFg,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    backgroundColor: t.primary,
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 10,
    opacity: {
      default: 1,
      ":disabled": 0.4,
    },
  },
  dangerBtn: {
    height: 36,
    paddingBlock: 0,
    paddingInline: 14,
    fontSize: 13,
    fontWeight: 600,
    color: "#ffffff",
    cursor: "pointer",
    backgroundColor: t.danger,
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 10,
  },
  stateBox: {
    paddingBlock: 40,
    paddingInline: 16,
    fontSize: 14,
    color: t.muted,
    textAlign: "center",
  },
  emptyBox: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "center",
    paddingBlock: 44,
    paddingInline: 20,
    textAlign: "center",
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 18,
  },
  emptyIcon: {
    display: "grid",
    placeItems: "center",
    width: 40,
    height: 40,
    color: t.muted,
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 12,
  },
  emptyTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
  },
  emptyDesc: {
    maxWidth: 360,
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: t.muted,
  },
});
