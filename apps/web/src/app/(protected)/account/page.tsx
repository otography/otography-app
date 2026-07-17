import * as stylex from "@stylexjs/stylex";
import { colorTokens as c, uiTokens as ui, layoutTokens as layout } from "@/styles/tokens.stylex";
import { requireAuth } from "@/features/auth";
import { SignOutButton } from "@/features/auth";

const styles = stylex.create({
  page: {
    display: "grid",
    placeItems: "center",
    minHeight: "100dvh",
    padding: "2rem",
    backgroundColor: c.background,
    color: c.foreground,
  },
  pageTinted: {
    backgroundColor: ui.cardBg,
  },
  card: {
    width: "100%",
    maxWidth: layout.accountCardWidth,
    padding: "2rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: ui.inputBorder,
    borderRadius: "1rem",
    backgroundColor: ui.white,
    display: "grid",
    gap: "1rem",
  },
  title: {
    margin: 0,
  },
  welcomeText: {
    margin: 0,
    lineHeight: 1.5,
  },
  usernameText: {
    margin: 0,
    lineHeight: 1.5,
  },
});

export default async function AccountPage() {
  const { profile } = await requireAuth();

  return (
    <main {...stylex.props(styles.page, styles.pageTinted)}>
      <section {...stylex.props(styles.card)}>
        <h1 {...stylex.props(styles.title)}>Account</h1>
        <p {...stylex.props(styles.welcomeText)}>Welcome, {profile.name ?? profile.username}</p>
        {profile.email ? <p {...stylex.props(styles.welcomeText)}>{profile.email}</p> : null}
        <p {...stylex.props(styles.usernameText)}>@{profile.username}</p>
        <SignOutButton />
      </section>
    </main>
  );
}
