import * as stylex from "@stylexjs/stylex";
import { shared } from "@/styles/shared.stylex";
import { requireAuth } from "@/features/auth";
import { SignOutButton } from "@/features/auth";

export default async function AccountPage() {
  const { profile } = await requireAuth();

  return (
    <main {...stylex.props(shared.centeredPage, shared.cardBgTinted)}>
      <section {...stylex.props(shared.card, shared.accountCard)}>
        <h1 style={{ margin: 0 }}>Account</h1>
        <p {...stylex.props(shared.welcomeText)}>Welcome, {profile.name ?? profile.username}</p>
        {profile.email ? <p {...stylex.props(shared.welcomeText)}>{profile.email}</p> : null}
        <p {...stylex.props(shared.usernameText)}>@{profile.username}</p>
        <SignOutButton />
      </section>
    </main>
  );
}
