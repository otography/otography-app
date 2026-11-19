import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { POST_CONTENT_MAX } from "db/constants";
import { useState } from "react";
import { PostCard } from "#/posts/PostCard";
import { searchPostsQuery } from "#/posts/queries";
import { meQuery } from "#/profiles/queries";
import { colors, radius, space } from "#/styles/tokens.stylex";
import { PrimaryButton } from "#/ui/button";

export const Route = createFileRoute("/search")({
  // 探した言葉を URL（?q=）に残し、戻る・共有で同じ結果を出せるようにする。
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined,
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const me = useQuery(meQuery);
  const [text, setText] = useState(q ?? "");
  const results = useQuery({ ...searchPostsQuery(q ?? ""), enabled: !!me.data && !!q });

  if (me.isPending) return <p {...stylex.props(styles.page)}>読み込み中…</p>;
  if (!me.data) {
    return (
      <p {...stylex.props(styles.page)}>
        感想を探すにはログインが必要です。<Link to="/">トップ</Link>からログインしてください。
      </p>
    );
  }

  return (
    <div {...stylex.props(styles.page, styles.stack)}>
      <h1 {...stylex.props(styles.title)}>感想を探す</h1>
      <form
        role="search"
        {...stylex.props(styles.form)}
        onSubmit={(event) => {
          event.preventDefault();
          const next = text.trim();
          if (next) void navigate({ search: { q: next } });
        }}
      >
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="例：受験期に支えられた曲"
          aria-label="探したい感想"
          maxLength={POST_CONTENT_MAX}
          {...stylex.props(styles.input)}
        />
        <PrimaryButton type="submit" disabled={!text.trim()}>
          探す
        </PrimaryButton>
      </form>
      {q && results.isPending && <p {...stylex.props(styles.muted)}>探しています…</p>}
      {results.isError && (
        <p role="alert" {...stylex.props(styles.error)}>
          {results.error.message}
        </p>
      )}
      {results.data?.length === 0 && <p {...stylex.props(styles.muted)}>見つかりませんでした</p>}
      {results.data?.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

const styles = stylex.create({
  page: { padding: space.xl, color: colors.text },
  stack: { display: "flex", flexDirection: "column", gap: space.md, maxWidth: 640 },
  title: { margin: 0, fontSize: 20 },
  form: { display: "flex", gap: space.sm },
  input: {
    flexGrow: 1,
    padding: space.sm,
    fontFamily: "inherit",
    fontSize: 16,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  muted: { margin: 0, fontSize: 14, color: colors.textMuted },
  error: { margin: 0, fontSize: 14, color: colors.accent },
});
