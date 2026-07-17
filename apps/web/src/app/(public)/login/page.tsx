import * as stylex from "@stylexjs/stylex";
import { colorTokens as c, uiTokens as ui, layoutTokens as layout } from "@/styles/tokens.stylex";
import { GoogleSignInButton, SignInForm } from "@/features/auth";

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
  googleButtonWrap: {
    marginTop: "1rem",
  },
});

export default function LoginPage() {
  return (
    <main {...stylex.props(styles.page)}>
      <section {...stylex.props(styles.card)}>
        <h1 {...stylex.props(styles.title)}>Login</h1>
        <p {...stylex.props(styles.lead)}>
          The browser only sends credentials to apps/api. It never stores Firebase tokens or talks
          to the database directly.
        </p>
        <SignInForm />
        <div {...stylex.props(styles.googleButtonWrap)}>
          <GoogleSignInButton />
        </div>
      </section>
    </main>
  );
}
