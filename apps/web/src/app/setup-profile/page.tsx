import { requireNoProfile } from "@/features/auth";
import { SetupProfileForm } from "@/features/auth";

export default async function SetupProfilePage() {
  await requireNoProfile();

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100dvh",
        padding: "2rem",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "32rem",
          padding: "2rem",
          border: "1px solid #d6d6d6",
          borderRadius: "0.75rem",
          backgroundColor: "#ffffff",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Set up your profile</h1>
        <p style={{ marginTop: 0, marginBottom: "1rem", lineHeight: 1.5 }}>
          Choose a username and display name to get started.
        </p>
        <SetupProfileForm />
      </section>
    </main>
  );
}
