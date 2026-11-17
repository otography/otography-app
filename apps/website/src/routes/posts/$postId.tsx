import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PostCard } from "#/posts/PostCard";
import { postQuery } from "#/posts/queries";
import { meQuery } from "#/profiles/queries";
import { colors, space } from "#/styles/tokens.stylex";

export const Route = createFileRoute("/posts/$postId")({ component: PostPage });

function PostPage() {
  const { postId } = Route.useParams();
  const me = useQuery(meQuery);
  const post = useQuery({ ...postQuery(postId), enabled: !!me.data });

  if (me.isPending) return <p {...stylex.props(styles.page)}>読み込み中…</p>;
  if (!me.data) {
    return (
      <p {...stylex.props(styles.page)}>
        投稿を見るにはログインが必要です。<Link to="/">トップ</Link>からログインしてください。
      </p>
    );
  }
  if (post.isPending) return <p {...stylex.props(styles.page)}>読み込み中…</p>;
  if (post.isError) return <p {...stylex.props(styles.page, styles.error)}>{post.error.message}</p>;

  return (
    <div {...stylex.props(styles.page, styles.stack)}>
      <PostCard post={post.data} />
    </div>
  );
}

const styles = stylex.create({
  page: { padding: space.xl, color: colors.text },
  stack: { display: "flex", flexDirection: "column", maxWidth: 640 },
  error: { color: colors.accent },
});
