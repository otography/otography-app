import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "#/lib/api";
import { colors, radius, space } from "#/styles/tokens.stylex";
import { setLikeInCaches } from "./post-cache";
import type { PostView } from "./queries";

/**
 * いいねを付け外しするボタン。押した時点で表示を変え（楽観的更新）、失敗したら元に戻す。
 * 成功したら、サーバーが数え直した件数で表示を合わせる。
 */
export function LikeButton({ post }: { post: Pick<PostView, "id" | "likeCount" | "likedByMe"> }) {
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: async (like: boolean) => {
      const param = { param: { id: post.id } };
      const res = like
        ? await client.api.posts[":id"].like.$put(param)
        : await client.api.posts[":id"].like.$delete(param);
      const body = await res.json();
      if ("error" in body) throw new Error(body.error);
      return body;
    },
    onMutate: (like) => {
      const previous = { likeCount: post.likeCount, likedByMe: post.likedByMe };
      setLikeInCaches(queryClient, post.id, {
        likedByMe: like,
        likeCount: Math.max(0, post.likeCount + (like ? 1 : -1)),
      });
      return previous;
    },
    onError: (_error, _like, previous) => {
      if (previous) setLikeInCaches(queryClient, post.id, previous);
    },
    onSuccess: (like) => setLikeInCaches(queryClient, post.id, like),
  });

  return (
    <button
      type="button"
      aria-pressed={post.likedByMe}
      aria-label={post.likedByMe ? "いいねを外す" : "いいね"}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate(!post.likedByMe)}
      {...stylex.props(styles.button, post.likedByMe && styles.liked)}
    >
      <span aria-hidden>{post.likedByMe ? "♥" : "♡"}</span> {post.likeCount}
    </button>
  );
}

const styles = stylex.create({
  button: {
    display: "inline-flex",
    gap: space.xs,
    alignItems: "center",
    paddingBlock: space.xs,
    paddingInline: space.sm,
    fontSize: 14,
    color: colors.textMuted,
    cursor: "pointer",
    backgroundColor: "transparent",
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.md,
  },
  liked: {
    color: colors.accent,
    borderColor: colors.accent,
  },
});
