"use client";

import * as stylex from "@stylexjs/stylex";
import { shared } from "@/styles/shared.stylex";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main {...stylex.props(shared.centeredPage, shared.errorPageBg)}>
      <section {...stylex.props(shared.errorSection)}>
        <p {...stylex.props(shared.errorLabel)}>Unexpected error</p>
        <h1 {...stylex.props(shared.errorHeading)}>Something went wrong.</h1>
        <p {...stylex.props(shared.errorBody)}>
          The page could not finish loading. Please try again in a moment.
        </p>
        <button onClick={reset} {...stylex.props(shared.errorRetryButton)}>
          Try again
        </button>
      </section>
    </main>
  );
}
