import { GoogleSignInButton, SignInForm } from "@/features/auth";

export default function LoginPage() {
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
        <h1 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Login</h1>
        <p style={{ marginTop: 0, marginBottom: "1rem", lineHeight: 1.5 }}>
          The browser only sends credentials to apps/api. It never stores Firebase tokens or talks
          to the database directly.
        </p>
        <SignInForm />
        <div style={{ marginTop: "1rem" }}>
          <GoogleSignInButton />
        </div>
      </section>
    </main>
  );
}
