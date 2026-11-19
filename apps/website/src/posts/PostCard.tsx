import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";
import { artworkUrl } from "#/lib/musickit";
import { colors, radius, space } from "#/styles/tokens.stylex";
import { useQuery } from "@tanstack/react-query";
import { meQuery } from "#/profiles/queries";
import { Avatar } from "#/ui/avatar";
import { ReportButton } from "#/reports/ReportButton";
import { DeletePostButton } from "./DeletePostButton";
import { LikeButton } from "./LikeButton";
import type { PostView } from "./queries";

const dateFormat = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" });

/** 投稿 1 件。投稿者、曲、本文、いいねのボタンを出す。 */
export function PostCard({ post }: { post: PostView }) {
  const me = useQuery(meQuery);
  const mine = me.data?.publicId === post.author.publicId;
  return (
    <article {...stylex.props(styles.card)}>
      <header {...stylex.props(styles.header)}>
        <Link
          to="/u/$publicId"
          params={{ publicId: post.author.publicId }}
          {...stylex.props(styles.author)}
        >
          <Avatar name={post.author.name} image={post.author.image} size={32} />
          {post.author.name}
        </Link>
        <Link to="/posts/$postId" params={{ postId: post.id }} {...stylex.props(styles.muted)}>
          <time dateTime={post.createdAt}>{dateFormat.format(new Date(post.createdAt))}</time>
        </Link>
      </header>
      {post.song && (
        <div {...stylex.props(styles.song)}>
          {post.song.artworkUrl && (
            <img
              src={artworkUrl(post.song.artworkUrl, 96)}
              alt=""
              width={48}
              height={48}
              {...stylex.props(styles.artwork)}
            />
          )}
          <div {...stylex.props(styles.songMeta)}>
            {post.song.url ? (
              <a
                href={post.song.url}
                target="_blank"
                rel="noreferrer"
                {...stylex.props(styles.songTitle)}
              >
                {post.song.title ?? "（曲名なし）"}
              </a>
            ) : (
              <span {...stylex.props(styles.songTitle)}>{post.song.title ?? "（曲名なし）"}</span>
            )}
            {post.song.artistName && (
              <span {...stylex.props(styles.muted)}>{post.song.artistName}</span>
            )}
          </div>
        </div>
      )}
      <p {...stylex.props(styles.content)}>{post.content}</p>
      <footer {...stylex.props(styles.footer)}>
        <LikeButton post={post} />
        {mine ? (
          <DeletePostButton postId={post.id} />
        ) : (
          <ReportButton target={{ postId: post.id }} />
        )}
      </footer>
    </article>
  );
}

const styles = stylex.create({
  card: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    padding: space.md,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.md,
  },
  header: {
    display: "flex",
    gap: space.sm,
    alignItems: "center",
    justifyContent: "space-between",
  },
  author: {
    display: "flex",
    gap: space.sm,
    alignItems: "center",
    minWidth: 0,
    fontWeight: 600,
    color: "inherit",
  },
  song: { display: "flex", gap: space.sm, alignItems: "center" },
  artwork: { borderRadius: radius.sm },
  songMeta: { display: "flex", flexDirection: "column", minWidth: 0 },
  songTitle: { fontWeight: 600, color: "inherit" },
  content: { margin: 0, overflowWrap: "anywhere", whiteSpace: "pre-wrap" },
  muted: { fontSize: 14, color: colors.textMuted },
  footer: { display: "flex", gap: space.sm, alignItems: "center", justifyContent: "space-between" },
});
