import * as stylex from "@stylexjs/stylex";
import { shared } from "@/styles/shared.stylex";
import { GoogleSignInButton, SignUpForm } from "@/features/auth";

export default function SignUpPage() {
  return (
    <main {...stylex.props(shared.centeredPage)}>
      <section {...stylex.props(shared.card)}>
        <h1 {...stylex.props(shared.cardTitle)}>Sign up</h1>
        <SignUpForm />
        <div {...stylex.props(shared.marginTop1)}>
          <GoogleSignInButton from="/signup" />
        </div>
      </section>
    </main>
  );
}
