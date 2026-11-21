import { create, props } from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";
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
import { Toggle } from "@ui-sdk/react/toggle";
import { MusicNoteIcon } from "#/chat/icons";
import { chatMedia, chatTokens as t } from "#/chat/tokens.stylex";
import { artworkUrl } from "#/lib/musickit";
import type { AppleSong } from "#/lib/musickit";
import type { PostView } from "#/lib/posts";
import { motion } from "#/motion.stylex";
import { PreviewToggle } from "#/songs/PreviewToggle";
import { HeartFilledIcon, HeartIcon, TrashIcon } from "./icons";
import { useProfile } from "./ProfileContext";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return dateFormatter.format(date);
}

function PostCard({ post, catalogSong }: { post: PostView; catalogSong?: AppleSong }) {
  const { state, actions } = useProfile();
  const songTitle = post.song?.title ?? "（曲名なし）";
  const isDeleting = state.deletingPostId === post.id;
  const isLiking = state.likingPostId === post.id;

  return (
    <article {...props(styles.card)}>
      {post.song ? (
        <div {...props(styles.songRow)}>
          <div {...props(styles.artWrap)}>
            {post.song.artworkUrl ? (
              <img
                src={artworkUrl(post.song.artworkUrl, 96)}
                alt=""
                width={44}
                height={44}
                {...props(styles.art)}
              />
            ) : (
              <div {...props(styles.art, styles.artFallback)} aria-hidden="true">
                <MusicNoteIcon />
              </div>
            )}
          </div>
          <div {...props(styles.songMeta)}>
            {post.song.url ? (
              <a
                href={post.song.url}
                target="_blank"
                rel="noreferrer"
                {...props(styles.songTitle, styles.songTitleLink)}
              >
                {songTitle}
              </a>
            ) : (
              <span {...props(styles.songTitle)}>{songTitle}</span>
            )}
            {post.song.artistName ? (
              <span {...props(styles.songArtist)}>{post.song.artistName}</span>
            ) : null}
          </div>
          {catalogSong ? (
            <PreviewToggle song={catalogSong} title={songTitle} style={styles.iconBtn} />
          ) : null}
        </div>
      ) : null}

      <p {...props(styles.content)}>{post.content}</p>

      <footer {...props(styles.footer)}>
        <time dateTime={post.createdAt} {...props(styles.date)}>
          {formatDate(post.createdAt)}
        </time>

        <div {...props(styles.actions)}>
          <Toggle
            pressed={post.likedByMe}
            disabled={isLiking}
            aria-label={`${songTitle} の投稿にいいね`}
            onPressedChange={(next) => {
              void actions.toggleLike(post.id, next);
            }}
            {...props(styles.likeToggle, post.likedByMe && styles.likeTogglePressed)}
          >
            {post.likedByMe ? <HeartFilledIcon /> : <HeartIcon />}
            <span {...props(styles.likeCount)}>{post.likeCount}</span>
          </Toggle>

          <AlertDialog pendingAnnouncement="投稿を削除しています">
            <AlertDialogTrigger
              disabled={isDeleting}
              aria-label={`「${songTitle}」の投稿を削除`}
              {...props(styles.deleteBtn)}
            >
              <TrashIcon />
            </AlertDialogTrigger>
            <AlertDialogBackdrop {...props(styles.backdrop)} />
            <AlertDialogContent {...props(styles.dialog)}>
              <AlertDialogTitle {...props(styles.dialogTitle)}>
                この投稿を削除しますか？
              </AlertDialogTitle>
              <AlertDialogDescription {...props(styles.dialogDesc)}>
                「{songTitle}」への感想を削除します。削除した投稿は元に戻せません。
              </AlertDialogDescription>
              <div {...props(styles.dialogFooter)}>
                <AlertDialogClose {...props(styles.secondaryBtn)}>キャンセル</AlertDialogClose>
                <AlertDialogClose
                  value="confirm"
                  data-agent-confirm={`「${songTitle}」の投稿を削除します`}
                  action={() => actions.deletePost(post.id)}
                  {...props(styles.dangerBtn)}
                >
                  完全に削除
                </AlertDialogClose>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </footer>
    </article>
  );
}

export function ProfilePostsPanel() {
  const { state, actions } = useProfile();

  if (state.isPostsPending) {
    return (
      <div {...props(styles.stateBox)} aria-busy="true">
        投稿を読み込んでいます…
      </div>
    );
  }

  if (state.postsError) {
    return (
      <div role="alert" {...props(styles.errorBox)}>
        {state.postsError}
      </div>
    );
  }

  if (state.posts.length === 0) {
    return (
      <div {...props(styles.emptyBox)}>
        <div {...props(styles.emptyIcon)} aria-hidden="true">
          <MusicNoteIcon />
        </div>
        <h2 {...props(styles.emptyTitle)}>まだ投稿がありません</h2>
        <p {...props(styles.emptyDesc)}>
          気に入った曲の感想を書くと、ここに自分の記録が溜まっていきます。
        </p>
        <Button render={<Link to="/" />} {...props(styles.emptyCta)}>
          最初の感想を投稿する
        </Button>
      </div>
    );
  }

  return (
    <div {...props(styles.list)}>
      {state.posts.map((post) => {
        const catalogSong = post.song
          ? (state.catalogSongs.byId.get(post.song.appleSongId) ??
            state.catalogSongs.byIsrc.get(post.song.isrc.toUpperCase()))
          : undefined;
        return <PostCard key={post.id} post={post} catalogSong={catalogSong} />;
      })}

      {state.hasNextPosts ? (
        <div {...props(styles.moreWrap)}>
          <Button
            type="button"
            disabled={state.isFetchingNextPosts}
            onClick={actions.fetchMorePosts}
            {...props(styles.moreBtn)}
          >
            {state.isFetchingNextPosts ? "読み込み中…" : "さらに表示"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const styles = create({
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 16,
  },
  songRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    paddingBlock: 8,
    paddingInline: 10,
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 12,
  },
  artWrap: {
    flexShrink: 0,
    width: 44,
    height: 44,
    overflow: "hidden",
    borderRadius: 8,
  },
  art: {
    display: "block",
    width: 44,
    height: 44,
    objectFit: "cover",
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
    gap: 2,
    minWidth: 0,
  },
  songTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 14,
    fontWeight: 600,
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
    fontSize: 12,
    color: t.muted,
    whiteSpace: "nowrap",
  },
  iconBtn: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 30,
    height: 30,
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
      default: `transform 160ms ${motion.easeOut}, background-color 150ms ease, color 150ms ease`,
      [chatMedia.reducedMotion]: "background-color 120ms ease, color 120ms ease",
    },
  },
  content: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.65,
    color: t.text,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  footer: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopColor: t.border,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  date: {
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    color: t.muted,
  },
  actions: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },
  likeToggle: {
    display: "inline-flex",
    gap: 5,
    alignItems: "center",
    height: 28,
    paddingBlock: 0,
    paddingInline: 9,
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
    borderRadius: 9999,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 160ms ${motion.easeOut}, background-color 150ms ease, color 150ms ease, border-color 150ms ease`,
      [chatMedia.reducedMotion]:
        "background-color 120ms ease, color 120ms ease, border-color 120ms ease",
    },
  },
  likeTogglePressed: {
    color: t.danger,
    borderColor: t.danger,
  },
  likeCount: {
    fontVariantNumeric: "tabular-nums",
  },
  deleteBtn: {
    display: "grid",
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
    transform: {
      default: null,
      ":active": {
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 160ms ${motion.easeOut}, background-color 150ms ease, color 150ms ease`,
      [chatMedia.reducedMotion]: "background-color 120ms ease, color 120ms ease",
    },
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    backdropFilter: "blur(2px)",
  },
  dialog: {
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
  dialogTitle: {
    margin: 0,
    marginBottom: 8,
    fontSize: 17,
    fontWeight: 600,
  },
  dialogDesc: {
    margin: 0,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 1.6,
    color: t.muted,
  },
  dialogFooter: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
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
  errorBox: {
    padding: 16,
    fontSize: 14,
    color: t.danger,
    backgroundColor: t.surface,
    borderColor: t.danger,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 14,
  },
  emptyBox: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "center",
    paddingBlock: 48,
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
    fontSize: 16,
    fontWeight: 600,
  },
  emptyDesc: {
    maxWidth: 360,
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: t.muted,
  },
  emptyCta: {
    display: "inline-flex",
    alignItems: "center",
    height: 36,
    paddingBlock: 0,
    paddingInline: 16,
    marginTop: 6,
    fontSize: 13,
    fontWeight: 600,
    color: t.primaryFg,
    textDecoration: "none",
    backgroundColor: t.primary,
    borderRadius: 10,
  },
  moreWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: 4,
  },
  moreBtn: {
    height: 36,
    paddingBlock: 0,
    paddingInline: 18,
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
    },
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 10,
  },
});
