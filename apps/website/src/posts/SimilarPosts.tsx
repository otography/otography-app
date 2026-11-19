import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { colors, space } from "#/styles/tokens.stylex";
import { PostCard } from "./PostCard";
import { similarPostsQuery } from "./queries";

/** 投稿に近い感想を 3 件出す。初めは別の曲の感想だけを出し、切り替えで同じ曲の感想も含める。 */
export function SimilarPosts({ postId }: { postId: string }) {
  const [includeSameSong, setIncludeSameSong] = useState(false);
  const query = useQuery(similarPostsQuery(postId, includeSameSong));

  return (
    <section {...stylex.props(styles.section)} aria-labelledby="similar-posts-heading">
      <h2 id="similar-posts-heading" {...stylex.props(styles.heading)}>
        近い感想
      </h2>
      <label {...stylex.props(styles.toggle)}>
        <input
          type="checkbox"
          checked={includeSameSong}
          onChange={(event) => setIncludeSameSong(event.target.checked)}
        />
        同じ曲の感想も含める
      </label>
      {query.isPending && <p {...stylex.props(styles.muted)}>探しています…</p>}
      {query.isError && (
        <p role="alert" {...stylex.props(styles.error)}>
          {query.error.message}
        </p>
      )}
      {query.data?.length === 0 && <p {...stylex.props(styles.muted)}>近い感想はまだありません</p>}
      {query.data?.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
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
  toggle: { display: "flex", gap: space.xs, alignItems: "center", fontSize: 14 },
  muted: { margin: 0, fontSize: 14, color: colors.textMuted },
  error: { margin: 0, fontSize: 14, color: colors.accent },
});
