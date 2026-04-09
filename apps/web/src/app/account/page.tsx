import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { SignOutButton } from "@/features/auth";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100dvh",
        padding: "2rem",
        backgroundColor: "#f6f7fb",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "40rem",
          padding: "2rem",
          borderRadius: "1rem",
          border: "1px solid #d6d6d6",
          backgroundColor: "#ffffff",
          display: "grid",
          gap: "1rem",
        }}
      >
        <h1 style={{ margin: 0 }}>Account</h1>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Welcome, {user.profile.displayName ?? user.profile.email ?? user.userId}
        </p>
        {user.profile.email ? (
          <p style={{ margin: 0, lineHeight: 1.5 }}>{user.profile.email}</p>
        ) : null}
        <SignOutButton />
      </section>
    </main>
  );
}
