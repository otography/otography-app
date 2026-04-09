import { redirect } from "next/navigation";
import { UnauthenticatedError, NoProfileError } from "@repo/errors";
import { getCurrentUser } from "@/lib/current-user";
import { SignOutButton } from "@/features/auth";

export default async function AccountPage() {
  const result = await getCurrentUser();

  if (result instanceof UnauthenticatedError) {
    redirect("/login");
  }

  if (result instanceof NoProfileError) {
    redirect("/setup-profile");
  }

  if (result instanceof Error) {
    throw result;
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
          Welcome, {result.profile.name ?? result.profile.username}
        </p>
        {result.profile.email ? (
          <p style={{ margin: 0, lineHeight: 1.5 }}>{result.profile.email}</p>
        ) : null}
        <p style={{ margin: 0, lineHeight: 1.5 }}>@{result.profile.username}</p>
        <SignOutButton />
      </section>
    </main>
  );
}
