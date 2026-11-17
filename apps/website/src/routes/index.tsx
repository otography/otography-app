import * as stylex from "@stylexjs/stylex";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { authClient } from "#/lib/auth-client";
import { CreatePostComposer } from "#/posts/CreatePostComposer";
import { meQuery } from "#/profiles/queries";
import { colors, space } from "#/styles/tokens.stylex";
import { Button } from "#/ui/button";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const queryClient = useQueryClient();
  const me = useQuery(meQuery);

  if (me.isPending) return <p {...stylex.props(styles.page)}>読み込み中…</p>;

  if (!me.data) {
    return (
      <div {...stylex.props(styles.page)}>
        <Button
          onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: "/" })}
        >
          Google でログイン
        </Button>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.page, styles.stack)}>
      <header {...stylex.props(styles.header)}>
        <span {...stylex.props(styles.muted)}>{me.data.name} としてログイン中</span>
        <Link to="/u/$publicId" params={{ publicId: me.data.publicId }}>
          プロフィール
        </Link>
        <Link to="/settings/profile">プロフィールを編集</Link>
        <Button
          onClick={() =>
            void authClient
              .signOut()
              .then(() => queryClient.invalidateQueries({ queryKey: meQuery.queryKey }))
          }
        >
          ログアウト
        </Button>
      </header>
      <CreatePostComposer />
    </div>
  );
}

const styles = stylex.create({
  page: { padding: space.xl, color: colors.text },
  stack: { display: "flex", flexDirection: "column", gap: space.lg, alignItems: "flex-start" },
  header: { display: "flex", flexWrap: "wrap", gap: space.md, alignItems: "center" },
  muted: { color: colors.textMuted },
});
