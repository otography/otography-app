import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { DeleteAccountSection } from "#/profiles/DeleteAccountSection";
import { FavoriteArtistsEditor } from "#/profiles/FavoriteArtistsEditor";
import { FavoriteSongsEditor } from "#/profiles/FavoriteSongsEditor";
import { ProfileFieldsForm } from "#/profiles/ProfileFieldsForm";
import { meQuery, profileQuery } from "#/profiles/queries";
import { colors, space } from "#/styles/tokens.stylex";

export const Route = createFileRoute("/settings/profile")({ component: EditProfilePage });

function EditProfilePage() {
  const me = useQuery(meQuery);
  const publicId = me.data?.publicId ?? "";
  const profile = useQuery({ ...profileQuery(publicId), enabled: !!publicId });

  if (me.isPending) return <p {...stylex.props(styles.page)}>読み込み中…</p>;
  if (!me.data) {
    return (
      <p {...stylex.props(styles.page)}>
        ログインが必要です。<Link to="/">トップ</Link>からログインしてください。
      </p>
    );
  }
  if (profile.isPending) return <p {...stylex.props(styles.page)}>読み込み中…</p>;
  if (profile.isError)
    return <p {...stylex.props(styles.page, styles.error)}>{profile.error.message}</p>;

  return (
    <div {...stylex.props(styles.page, styles.stack)}>
      <header {...stylex.props(styles.header)}>
        <h1 {...stylex.props(styles.title)}>プロフィールの編集</h1>
        <Link to="/u/$publicId" params={{ publicId }}>
          プロフィールを見る
        </Link>
      </header>
      <ProfileFieldsForm name={me.data.name} bio={me.data.bio} />
      <FavoriteSongsEditor profile={profile.data} />
      <FavoriteArtistsEditor profile={profile.data} />
      <DeleteAccountSection />
    </div>
  );
}

const styles = stylex.create({
  page: { padding: space.xl, color: colors.text },
  stack: { display: "flex", flexDirection: "column", gap: space.xl },
  header: { display: "flex", gap: space.md, alignItems: "baseline" },
  title: { margin: 0, fontSize: 24 },
  error: { color: colors.accent },
});
