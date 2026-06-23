import * as stylex from "@stylexjs/stylex";
import { shared } from "@/styles/shared.stylex";
import { requireNoProfile } from "@/features/auth";
import { SetupProfileForm } from "@/features/auth";

export default async function SetupProfilePage() {
  await requireNoProfile();

  return (
    <main {...stylex.props(shared.centeredPage)}>
      <section {...stylex.props(shared.card)}>
        <h1 {...stylex.props(shared.cardTitle)}>Set up your profile</h1>
        <p {...stylex.props(shared.cardLead)}>Choose a username and display name to get started.</p>
        <SetupProfileForm />
      </section>
    </main>
  );
}
