import * as stylex from "@stylexjs/stylex";
import { colorTokens as c, uiTokens as ui, layoutTokens as layout } from "@/styles/tokens.stylex";
import { requireNoProfile } from "@/features/auth";
import { SetupProfileForm } from "@/features/auth";

const styles = stylex.create({
  page: {
    display: "grid",
    placeItems: "center",
    minHeight: "100dvh",
    padding: "2rem",
    backgroundColor: c.background,
    color: c.foreground,
  },
  card: {
    width: "100%",
    maxWidth: layout.cardWidth,
    padding: "2rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: ui.inputBorder,
    borderRadius: "0.75rem",
    backgroundColor: ui.white,
  },
  title: {
    marginTop: 0,
    marginBottom: "0.75rem",
  },
  lead: {
    marginTop: 0,
    marginBottom: "1rem",
    lineHeight: 1.5,
  },
});

export default async function SetupProfilePage() {
  await requireNoProfile();

  return (
    <main {...stylex.props(styles.page)}>
      <section {...stylex.props(styles.card)}>
        <h1 {...stylex.props(styles.title)}>Set up your profile</h1>
        <p {...stylex.props(styles.lead)}>Choose a username and display name to get started.</p>
        <SetupProfileForm />
      </section>
    </main>
  );
}
