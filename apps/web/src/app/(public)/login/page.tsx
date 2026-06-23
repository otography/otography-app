import * as stylex from "@stylexjs/stylex";
import { shared } from "@/styles/shared.stylex";
import { GoogleSignInButton, SignInForm } from "@/features/auth";

export default function LoginPage() {
  return (
    <main {...stylex.props(shared.centeredPage)}>
      <section {...stylex.props(shared.card)}>
        <h1 {...stylex.props(shared.cardTitle)}>Login</h1>
        <p {...stylex.props(shared.cardLead)}>
          The browser only sends credentials to apps/api. It never stores Firebase tokens or talks
          to the database directly.
        </p>
        <SignInForm />
        <div {...stylex.props(shared.marginTop1)}>
          <GoogleSignInButton />
        </div>
      </section>
    </main>
  );
}
