"use client";

import * as stylex from "@stylexjs/stylex";
import { uiTokens as ui, layoutTokens as layout } from "@/styles/tokens.stylex";

const styles = stylex.create({
  page: {
    display: "grid",
    placeItems: "center",
    minHeight: "100dvh",
    padding: "2rem",
    backgroundColor: "#f7f7f3",
    color: ui.darkBg,
  },
  section: {
    display: "grid",
    gap: "1rem",
    width: "100%",
    maxWidth: layout.errorPageWidth,
  },
  label: {
    color: "#6b6b63",
    fontSize: "0.875rem",
    margin: 0,
  },
  heading: {
    fontSize: "2rem",
    lineHeight: 1.15,
    margin: 0,
  },
  body: {
    color: "#4b4b45",
    lineHeight: 1.6,
    margin: 0,
  },
  retryButton: {
    justifySelf: "start",
    minHeight: "2.75rem",
    padding: "0 1rem",
    borderRadius: "0.5rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: ui.darkBg,
    background: ui.darkBg,
    color: ui.white,
    font: "inherit",
    cursor: "pointer",
  },
});

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main {...stylex.props(styles.page)}>
      <section {...stylex.props(styles.section)}>
        <p {...stylex.props(styles.label)}>Unexpected error</p>
        <h1 {...stylex.props(styles.heading)}>Something went wrong.</h1>
        <p {...stylex.props(styles.body)}>
          The page could not finish loading. Please try again in a moment.
        </p>
        <button onClick={reset} {...stylex.props(styles.retryButton)}>
          Try again
        </button>
      </section>
    </main>
  );
}
