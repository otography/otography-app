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
import { CloseIcon, PlusIcon } from "#/chat/icons";
import { chatMedia, chatTokens as t } from "#/chat/tokens.stylex";
import { type AppleArtist, artworkUrl, searchArtists } from "#/lib/musickit";
import type { FavoriteArtistItem, FavoriteDecoration } from "#/lib/profile";
import { motion } from "#/motion.stylex";
import { FavoriteDecorationFields, validateDecoration } from "./FavoriteDecorationEditor";
import { ChevronDownIcon, ChevronUpIcon, EditIcon, SearchIcon, TrashIcon, UserIcon } from "./icons";
import { useProfile } from "./ProfileContext";
import { favoriteAccentStyles } from "./favorite-colors";

const EMPTY_DECORATION: FavoriteDecoration = { comment: null, emoji: null, color: null };

function AddFavoriteArtistDialog() {
  const { state, actions, meta } = useProfile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AppleArtist[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AppleArtist | null>(null);
  const [decoration, setDecoration] = useState<FavoriteDecoration>(EMPTY_DECORATION);

  const atLimit = state.favoriteArtists.length >= meta.favoriteLimit;
  const existingIds = new Set(state.favoriteArtists.map((item) => item.artist.id));

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
      searchArtists(query.trim())
        .then((artists) => {
          if (cancelled) return;
          setResults(artists);
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
  const canSave = Boolean(selected) && !emojiError && !commentError && !state.isSavingArtists;

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !canSave) return;
    try {
      await actions.addFavoriteArtist(selected, {
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
        <span>好きなアーティストを追加</span>
      </DialogTrigger>
      <DialogBackdrop {...stylex.props(styles.backdrop)} />
      <DialogContent {...stylex.props(styles.dialog)}>
        <div {...stylex.props(styles.dialogHeader)}>
          <div {...stylex.props(styles.dialogHeading)}>
            <DialogTitle {...stylex.props(styles.dialogTitle)}>
              好きなアーティストを追加
            </DialogTitle>
            <DialogDescription {...stylex.props(styles.dialogDesc)}>
              Apple Music からアーティストを検索して、最大 {meta.favoriteLimit} 組まで登録できます。
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
                  <UserIcon />
                </div>
              )}
              <div {...stylex.props(styles.meta)}>
                <span {...stylex.props(styles.title)}>{selected.attributes.name}</span>
                {selected.attributes.genreNames?.length ? (
                  <span {...stylex.props(styles.sub)}>
                    {selected.attributes.genreNames.slice(0, 2).join(" / ")}
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                {...stylex.props(styles.secondaryBtnSm)}
                onClick={() => setSelected(null)}
              >
                別のアーティストを選ぶ
              </Button>
            </div>
          ) : (
            <div {...stylex.props(styles.searchSection)}>
              <Field name="artist-search">
                <FieldLabel {...stylex.props(styles.label)}>アーティストを検索</FieldLabel>
                <div {...stylex.props(styles.searchInputWrap)}>
                  <span {...stylex.props(styles.searchIcon)} aria-hidden="true">
                    <SearchIcon />
                  </span>
                  <Input
                    value={query}
                    onValueChange={setQuery}
                    placeholder="アーティスト名を入力…"
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
                      ? "一致するアーティストが見つかりませんでした"
                      : results.length > 0
                        ? `${results.length} 件の候補`
                        : "キーワードを入力してアーティストを検索してください"}
              </div>

              {results.length > 0 ? (
                <ul {...stylex.props(styles.resultList)} aria-label="アーティストの検索結果">
                  {results.map((artist) => {
                    const alreadyAdded = existingIds.has(artist.id);
                    return (
                      <li key={artist.id} {...stylex.props(styles.resultRow)}>
                        <Button
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => setSelected(artist)}
                          {...stylex.props(styles.resultSelectBtn)}
                        >
                          {artist.attributes.artwork ? (
                            <img
                              src={artworkUrl(artist.attributes.artwork.url, 72)}
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
                              <UserIcon />
                            </span>
                          )}
                          <span {...stylex.props(styles.meta)}>
                            <span {...stylex.props(styles.title)}>{artist.attributes.name}</span>
                            {artist.attributes.genreNames?.length ? (
                              <span {...stylex.props(styles.sub)}>
                                {artist.attributes.genreNames.slice(0, 2).join(" / ")}
                              </span>
                            ) : null}
                          </span>
                          {alreadyAdded ? (
                            <span {...stylex.props(styles.badge)}>登録済み</span>
                          ) : null}
                        </Button>
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
              fieldPrefix="add-artist"
            />
          ) : null}

          <div {...stylex.props(styles.dialogFooter)}>
            <DialogClose {...stylex.props(styles.secondaryBtn)}>キャンセル</DialogClose>
            <Button type="submit" disabled={!canSave} {...stylex.props(styles.primaryBtn)}>
              {state.isSavingArtists ? "追加中…" : "リストに追加"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditFavoriteArtistDialog({ item }: { item: FavoriteArtistItem }) {
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

  const name = item.artist.name ?? "（アーティスト名なし）";
  const { emojiError, commentError } = validateDecoration(decoration);
  const canSave = !emojiError && !commentError && !state.isSavingArtists;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;
    try {
      await actions.updateFavoriteArtist(item.artist.id, {
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
      <DialogTrigger aria-label={`「${name}」のメモと飾りを編集`} {...stylex.props(styles.iconBtn)}>
        <EditIcon />
      </DialogTrigger>
      <DialogBackdrop {...stylex.props(styles.backdrop)} />
      <DialogContent {...stylex.props(styles.dialog)}>
        <div {...stylex.props(styles.dialogHeader)}>
          <div {...stylex.props(styles.dialogHeading)}>
            <DialogTitle {...stylex.props(styles.dialogTitle)}>「{name}」を編集</DialogTitle>
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
            fieldPrefix={`edit-artist-${item.artist.id}`}
          />
          <div {...stylex.props(styles.dialogFooter)}>
            <DialogClose {...stylex.props(styles.secondaryBtn)}>キャンセル</DialogClose>
            <Button type="submit" disabled={!canSave} {...stylex.props(styles.primaryBtn)}>
              {state.isSavingArtists ? "保存中…" : "変更を保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FavoriteArtistRow({
  item,
  index,
  total,
}: {
  item: FavoriteArtistItem;
  index: number;
  total: number;
}) {
  const { state, actions } = useProfile();
  const name = item.artist.name ?? "（アーティスト名なし）";
  const accentStyle = item.color ? favoriteAccentStyles[item.color] : null;

  return (
    <li {...stylex.props(styles.card, accentStyle)}>
      <div {...stylex.props(styles.cardMain)}>
        <span {...stylex.props(styles.rank)} aria-label={`${index + 1} 番目`}>
          {String(index + 1).padStart(2, "0")}
        </span>

        <div {...stylex.props(styles.artWrap)}>
          {item.artist.artworkUrl ? (
            <img
              src={artworkUrl(item.artist.artworkUrl, 112)}
              alt=""
              width={52}
              height={52}
              {...stylex.props(styles.cardArt)}
            />
          ) : (
            <div {...stylex.props(styles.cardArt, styles.artFallback)} aria-hidden="true">
              <UserIcon />
            </div>
          )}
          {item.emoji ? (
            <span {...stylex.props(styles.emojiBadge)} aria-hidden="true">
              {item.emoji}
            </span>
          ) : null}
        </div>

        <div {...stylex.props(styles.meta)}>
          {item.artist.url ? (
            <a
              href={item.artist.url}
              target="_blank"
              rel="noreferrer"
              {...stylex.props(styles.title, styles.titleLink)}
            >
              {name}
            </a>
          ) : (
            <span {...stylex.props(styles.title)}>{name}</span>
          )}
        </div>

        <div {...stylex.props(styles.rowActions)}>
          <Button
            type="button"
            disabled={index === 0 || state.isSavingArtists}
            aria-label={`「${name}」を上に移動`}
            onClick={() => void actions.moveFavoriteArtist(index, -1)}
            {...stylex.props(styles.iconBtn)}
          >
            <ChevronUpIcon />
          </Button>
          <Button
            type="button"
            disabled={index === total - 1 || state.isSavingArtists}
            aria-label={`「${name}」を下に移動`}
            onClick={() => void actions.moveFavoriteArtist(index, 1)}
            {...stylex.props(styles.iconBtn)}
          >
            <ChevronDownIcon />
          </Button>

          <EditFavoriteArtistDialog item={item} />

          <AlertDialog pendingAnnouncement="好きなアーティストから削除しています">
            <AlertDialogTrigger
              disabled={state.isSavingArtists}
              aria-label={`「${name}」を好きなアーティストから削除`}
              {...stylex.props(styles.deleteBtn)}
            >
              <TrashIcon />
            </AlertDialogTrigger>
            <AlertDialogBackdrop {...stylex.props(styles.backdrop)} />
            <AlertDialogContent {...stylex.props(styles.alertDialog)}>
              <AlertDialogTitle {...stylex.props(styles.dialogTitle)}>
                好きなアーティストから外しますか？
              </AlertDialogTitle>
              <AlertDialogDescription {...stylex.props(styles.dialogDesc)}>
                「{name}」を好きなアーティストリストから削除します。
              </AlertDialogDescription>
              <div {...stylex.props(styles.dialogFooter)}>
                <AlertDialogClose {...stylex.props(styles.secondaryBtn)}>
                  キャンセル
                </AlertDialogClose>
                <AlertDialogClose
                  value="confirm"
                  data-agent-confirm={`「${name}」を好きなアーティストから削除します`}
                  action={() => actions.removeFavoriteArtist(item.artist.id)}
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

export function FavoriteArtistsPanel() {
  const { state, meta } = useProfile();

  return (
    <div {...stylex.props(styles.panel)}>
      <div {...stylex.props(styles.panelBar)}>
        <div {...stylex.props(styles.panelInfo)}>
          <h2 {...stylex.props(styles.panelTitle)}>好きなアーティスト</h2>
          <span {...stylex.props(styles.panelCount)}>
            {state.favoriteArtists.length} / {meta.favoriteLimit}
          </span>
        </div>
        <AddFavoriteArtistDialog />
      </div>

      {state.isProfilePending ? (
        <div {...stylex.props(styles.stateBox)} aria-busy="true">
          好きなアーティストを読み込んでいます…
        </div>
      ) : state.favoriteArtists.length === 0 ? (
        <div {...stylex.props(styles.emptyBox)}>
          <div {...stylex.props(styles.emptyIcon)} aria-hidden="true">
            <UserIcon />
          </div>
          <p {...stylex.props(styles.emptyTitle)}>まだ好きなアーティストが登録されていません</p>
          <p {...stylex.props(styles.emptyDesc)}>
            よく聴くアーティストや推しのバンドを最大 {meta.favoriteLimit} 組まで並べられます。
          </p>
        </div>
      ) : (
        <ol {...stylex.props(styles.list)} aria-label="好きなアーティスト一覧">
          {state.favoriteArtists.map((item, index) => (
            <FavoriteArtistRow
              key={item.artist.id}
              item={item}
              index={index}
              total={state.favoriteArtists.length}
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
    borderRadius: 9999,
  },
  emojiBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
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
    borderRadius: 9999,
  },
  resultArt: {
    flexShrink: 0,
    width: 38,
    height: 38,
    objectFit: "cover",
    borderRadius: 9999,
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
