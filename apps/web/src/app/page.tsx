import Link from "next/link";
import { NoProfileError, UnauthenticatedError } from "@repo/errors";
import { getCurrentUser } from "@/lib/current-user";

export default async function Home() {
  const result = await getCurrentUser();

  let authState: "authenticated" | "noProfile" | "unauthenticated" = "unauthenticated";
  if (!(result instanceof Error)) {
    authState = "authenticated";
  } else if (result instanceof NoProfileError) {
    authState = "noProfile";
  } else if (result instanceof UnauthenticatedError) {
    authState = "unauthenticated";
  } else {
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
        <h1 style={{ margin: 0 }}>Otography</h1>
        <p style={{ margin: 0, lineHeight: 1.5 }}>Welcome to Otography App</p>
        {authState === "authenticated" ? (
          <Link
            href="/account"
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #d6d6d6",
              textAlign: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Account
          </Link>
        ) : authState === "noProfile" ? (
          <Link
            href="/setup-profile"
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #d6d6d6",
              textAlign: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Set up profile
          </Link>
        ) : (
          <Link
            href="/login"
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #d6d6d6",
              textAlign: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Sign in
          </Link>
        )}
      </section>
    </main>
  );
}
