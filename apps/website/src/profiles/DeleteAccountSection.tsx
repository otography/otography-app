import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "#/lib/auth-client";
import { client } from "#/lib/api";
import { colors, space } from "#/styles/tokens.stylex";
import { Button } from "#/ui/button";

/** 退会の欄。確認してから退会し、ログアウトしてトップへ戻る。 */
export function DeleteAccountSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const remove = useMutation({
    mutationFn: async () => {
      const res = await client.api.me.$delete();
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error);
      }
      // サーバーはセッションを消してある。ブラウザに残るセッションのクッキーも消す。
      await authClient.signOut();
    },
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: "/" });
    },
  });

  return (
    <section {...stylex.props(styles.section)}>
      <h2 {...stylex.props(styles.heading)}>退会</h2>
      <p {...stylex.props(styles.muted)}>
        退会すると、表示名・自己紹介・お気に入り・いいねがすぐに消え、投稿はすべての画面から消えます。元に戻せません。
      </p>
      <div>
        <Button
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm("本当に退会しますか？元に戻せません")) remove.mutate();
          }}
        >
          {remove.isPending ? "退会の処理中…" : "退会する"}
        </Button>
      </div>
      {remove.isError && (
        <p role="alert" {...stylex.props(styles.error)}>
          {remove.error.message}
        </p>
      )}
    </section>
  );
}

const styles = stylex.create({
  section: { display: "flex", flexDirection: "column", gap: space.sm, maxWidth: 640 },
  heading: { margin: 0, fontSize: 18 },
  muted: { margin: 0, fontSize: 14, color: colors.textMuted },
  error: { margin: 0, fontSize: 14, color: colors.accent },
});
