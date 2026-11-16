import * as stylex from "@stylexjs/stylex";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { client } from "#/lib/api";
import { authClient } from "#/lib/auth-client";
import { CreatePostComposer } from "#/posts/CreatePostComposer";
import { colors, radius, space } from "#/styles/tokens.stylex";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    // 200 ならログイン中、401 なら未ログイン（API の /api/me）。
    queryFn: async () => {
      const res = await client.api.me.$get();
      return res.ok ? res.json() : null;
    },
  });

  if (me.isPending) return <p {...stylex.props(styles.page)}>読み込み中…</p>;

  if (!me.data) {
    return (
      <div {...stylex.props(styles.page)}>
        <button
          type="button"
          {...stylex.props(styles.button)}
          onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: "/" })}
        >
          Google でログイン
        </button>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.page, styles.stack)}>
      <header {...stylex.props(styles.header)}>
        <span {...stylex.props(styles.muted)}>{me.data.name} としてログイン中</span>
        <button
          type="button"
          {...stylex.props(styles.button)}
          onClick={() =>
            void authClient
              .signOut()
              .then(() => queryClient.invalidateQueries({ queryKey: ["me"] }))
          }
        >
          ログアウト
        </button>
      </header>
      <CreatePostComposer />
    </div>
  );
}

const styles = stylex.create({
  page: {
    padding: space.xl,
    color: colors.text,
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: space.lg,
    alignItems: "flex-start",
  },
  header: {
    display: "flex",
    gap: space.md,
    alignItems: "center",
  },
  muted: {
    color: colors.textMuted,
  },
  button: {
    paddingBlock: space.sm,
    paddingInline: space.md,
    cursor: "pointer",
    backgroundColor: {
      default: colors.background,
      ":hover": "#f5f5f5",
    },
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
});
