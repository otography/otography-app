import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { SignUpForm } from "@/features/auth";

export default async function SignUpPage() {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect("/");
  }

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
      </section>
    </main>
  );
}
