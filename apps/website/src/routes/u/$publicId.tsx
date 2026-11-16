import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "#/profiles/ProfileView";
import { meQuery, profileQuery } from "#/profiles/queries";
import { colors, space } from "#/styles/tokens.stylex";

export const Route = createFileRoute("/u/$publicId")({ component: ProfilePage });

function ProfilePage() {
  const { publicId } = Route.useParams();
  const me = useQuery(meQuery);
  const profile = useQuery({ ...profileQuery(publicId), enabled: !!me.data });

  if (me.isPending) return <p {...stylex.props(styles.page)}>読み込み中…</p>;
  if (!me.data) {
    return (
      <p {...stylex.props(styles.page)}>
        プロフィールを見るにはログインが必要です。<Link to="/">トップ</Link>
        からログインしてください。
      </p>
    );
  }
  if (profile.isPending) return <p {...stylex.props(styles.page)}>読み込み中…</p>;
  if (profile.isError)
    return <p {...stylex.props(styles.page, styles.error)}>{profile.error.message}</p>;

  return (
    <div {...stylex.props(styles.page)}>
      <ProfileView
        profile={profile.data}
        actions={me.data.publicId === publicId && <Link to="/settings/profile">編集する</Link>}
      />
    </div>
  );
}

const styles = stylex.create({
  page: { padding: space.xl, color: colors.text },
  error: { color: colors.accent },
});
