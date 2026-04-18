import { GoogleSignInButton, SignUpForm } from "@/features/auth";

export default function SignUpPage() {
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
        <h1 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Sign up</h1>
        <SignUpForm />
        <div style={{ marginTop: "1rem" }}>
          <GoogleSignInButton from="/signup" />
        </div>
      </section>
    </main>
  );
}
