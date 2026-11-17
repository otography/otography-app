import * as stylex from "@stylexjs/stylex";
import { useInfiniteQuery } from "@tanstack/react-query";
import { colors, space } from "#/styles/tokens.stylex";
import { Button } from "#/ui/button";
import { PostCard } from "./PostCard";
import { authorPostsQuery } from "./queries";

/** ユーザーの投稿を新しい順に出す。「もっと見る」で続きを読む。 */
export function AuthorPosts({ publicId }: { publicId: string }) {
  const query = useInfiniteQuery(authorPostsQuery(publicId));

  return (
    <section {...stylex.props(styles.section)}>
      <h2 {...stylex.props(styles.heading)}>投稿</h2>
      {query.isPending && <p {...stylex.props(styles.muted)}>読み込み中…</p>}
      {query.isError && (
        <p role="alert" {...stylex.props(styles.error)}>
          {query.error.message}
        </p>
      )}
      {query.data?.pages[0]?.posts.length === 0 && (
        <p {...stylex.props(styles.muted)}>まだありません</p>
      )}
      {query.data?.pages
        .flatMap((page) => page.posts)
        .map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      {query.hasNextPage && (
        <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          {query.isFetchingNextPage ? "読み込み中…" : "もっと見る"}
        </Button>
      )}
    </section>
  );
}

const styles = stylex.create({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    width: "100%",
    maxWidth: 640,
  },
  heading: { margin: 0, fontSize: 16 },
  muted: { fontSize: 14, color: colors.textMuted },
  error: { fontSize: 14, color: colors.accent },
});
