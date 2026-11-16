import * as stylex from "@stylexjs/stylex";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { client } from "#/lib/api";
import { authClient } from "#/lib/auth-client";
import { colors, radius, space } from "#/styles/tokens.stylex";

export const Route = createFileRoute("/")({ component: Home });

type Me = { name: string; publicId: string };

// ログインの動作を確かめるための仮の画面。
function Home() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    void client.api.me.$get().then(async (res) => setMe(res.ok ? await res.json() : null));
  }, []);

  if (me === undefined) return <p {...stylex.props(styles.page)}>読み込み中…</p>;

  return (
    <div {...stylex.props(styles.page, styles.stack)}>
      {me ? (
        <>
          <p>
            {me.name}（{me.publicId}）としてログイン中
          </p>
          <button
            type="button"
            {...stylex.props(styles.button)}
            onClick={() => void authClient.signOut().then(() => setMe(null))}
          >
            ログアウト
          </button>
        </>
      ) : (
        <button
          type="button"
          {...stylex.props(styles.button)}
          onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: "/" })}
        >
          Google でログイン
        </button>
      )}
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
    gap: space.md,
    alignItems: "flex-start",
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
