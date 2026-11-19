import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { artworkUrl } from "#/lib/musickit";
import { SongPicker } from "#/songs/SongPicker";
import { SimilarPosts } from "../SimilarPosts";
import { colors, radius, space } from "#/styles/tokens.stylex";
import { usePostComposer } from "./context";

function Frame({ children }: { children: ReactNode }) {
  const { actions } = usePostComposer();
  return (
    <form
      {...stylex.props(styles.frame)}
      onSubmit={(event) => {
        event.preventDefault();
        actions.submit();
      }}
    >
      {children}
    </form>
  );
}

/** 曲を選ぶ欄。選ぶ前は検索、選んだ後は選んだ曲を表示する。 */
function SongField() {
  const { state, actions } = usePostComposer();
  if (!state.song) return <SongPicker onSelect={actions.selectSong} />;

  const { name, artistName, artwork } = state.song.attributes;
  return (
    <div {...stylex.props(styles.song)}>
      {artwork && <img src={artworkUrl(artwork.url, 128)} alt="" width={64} height={64} />}
      <div {...stylex.props(styles.songMeta)}>
        <span>{name}</span>
        <span {...stylex.props(styles.muted)}>{artistName}</span>
      </div>
      <button type="button" onClick={actions.clearSong} {...stylex.props(styles.button)}>
        曲を変える
      </button>
    </div>
  );
}

function Input({ placeholder = "この曲について一言" }: { placeholder?: string }) {
  const { state, actions } = usePostComposer();
  return (
    <textarea
      value={state.content}
      onChange={(event) => actions.updateContent(event.target.value)}
      placeholder={placeholder}
      aria-label="本文"
      rows={4}
      {...stylex.props(styles.textarea)}
    />
  );
}

function Footer({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.footer)}>{children}</div>;
}

function Counter() {
  const { state, meta } = usePostComposer();
  const over = state.length > meta.maxLength;
  return (
    <span {...stylex.props(over ? styles.error : styles.muted)}>
      {state.length} / {meta.maxLength}
    </span>
  );
}

function Submit({ children = "投稿する" }: { children?: ReactNode }) {
  const { state } = usePostComposer();
  return (
    <button
      type="submit"
      disabled={!state.canSubmit}
      {...stylex.props(styles.button, styles.primary)}
    >
      {state.isSubmitting ? "送信中…" : children}
    </button>
  );
}

function ErrorMessage() {
  const { state } = usePostComposer();
  if (!state.error) return null;
  return (
    <p role="alert" {...stylex.props(styles.error)}>
      {state.error}
    </p>
  );
}

/** 直前に投稿できたことを知らせる。 */
function LastPost() {
  const { state } = usePostComposer();
  if (!state.lastPost) return null;
  return (
    <p role="status" {...stylex.props(styles.success)}>
      「{state.lastPost.songTitle}」で投稿しました（
      <Link to="/posts/$postId" params={{ postId: state.lastPost.id }}>
        投稿を見る
      </Link>
      ）
    </p>
  );
}

/** 直前の投稿に近い感想。PostCard にボタンがあるので、Frame（form）の外に置く。 */
function Similar() {
  const { state } = usePostComposer();
  if (!state.lastPost) return null;
  return <SimilarPosts postId={state.lastPost.id} />;
}

/** 投稿の入力欄の部品。状態と操作は Provider（CreatePostProvider など）から受け取る。 */
export const Composer = {
  Frame,
  SongField,
  Input,
  Footer,
  Counter,
  Submit,
  Error: ErrorMessage,
  LastPost,
  Similar,
};

const styles = stylex.create({
  frame: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    width: "100%",
    maxWidth: 560,
  },
  song: {
    display: "flex",
    gap: space.md,
    alignItems: "center",
  },
  songMeta: {
    display: "flex",
    flexGrow: 1,
    flexDirection: "column",
  },
  textarea: {
    padding: space.sm,
    fontFamily: "inherit",
    fontSize: 16,
    resize: "vertical",
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  error: {
    margin: 0,
    fontSize: 14,
    color: colors.accent,
  },
  success: {
    margin: 0,
    color: colors.text,
  },
  button: {
    paddingBlock: space.sm,
    paddingInline: space.md,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  primary: {
    color: colors.background,
    backgroundColor: {
      default: colors.accent,
      ":disabled": colors.border,
    },
    borderColor: "transparent",
  },
});
