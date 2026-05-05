"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100dvh",
        padding: "2rem",
        backgroundColor: "#f7f7f3",
        color: "#171717",
      }}
    >
      <section
        style={{
          display: "grid",
          gap: "1rem",
          width: "100%",
          maxWidth: "34rem",
        }}
      >
        <p style={{ color: "#6b6b63", fontSize: "0.875rem", margin: 0 }}>Unexpected error</p>
        <h1 style={{ fontSize: "2rem", lineHeight: 1.15, margin: 0 }}>Something went wrong.</h1>
        <p style={{ color: "#4b4b45", lineHeight: 1.6, margin: 0 }}>
          The page could not finish loading. Please try again in a moment.
        </p>
        <button
          onClick={reset}
          style={{
            justifySelf: "start",
            minHeight: "2.75rem",
            padding: "0 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #171717",
            background: "#171717",
            color: "#ffffff",
            font: "inherit",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </section>
    </main>
  );
}
