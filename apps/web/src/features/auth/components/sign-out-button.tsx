"use client";

import { createContext, type ReactNode, useCallback, use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as stylex from "@stylexjs/stylex";
import { WebAuthClientError } from "@repo/errors";
import { api } from "@/features/lib/api";
import { uiTokens as ui } from "@/styles/tokens.stylex";

const styles = stylex.create({
  dangerButton: {
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    borderWidth: 0,
    borderStyle: "none",
    borderColor: "transparent",
    backgroundColor: ui.errorRed,
    color: ui.white,
  },
  errorText: {
    margin: 0,
    color: ui.errorRed,
  },
  gap: {
    display: "grid",
    gap: "0.75rem",
  },
});

interface SignOutState {
  error: string | null;
  isPending: boolean;
}

interface SignOutActions {
  signOut: () => Promise<void>;
}

interface SignOutContextValue {
  state: SignOutState;
  actions: SignOutActions;
}

const SignOutContext = createContext<SignOutContextValue | null>(null);

function SignOutProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SignOutState>({ error: null, isPending: false });

  const signOut = useCallback(async () => {
    setState({ error: null, isPending: true });

    const response = await api.auth["sign-out"].$post().catch(
      (e) =>
        new WebAuthClientError({
          message: "Unable to reach the authentication API.",
          cause: e,
        }),
    );

    if (response instanceof Error) {
      setState({ error: response.message, isPending: false });
      return;
    }

    if (!response.ok) {
      const payload = (await response.json().catch(
        (e) =>
          new WebAuthClientError({
            message: "Failed to parse sign-out error response.",
            cause: e,
          }),
      )) as WebAuthClientError | { detail?: string } | null;
      if (payload instanceof Error) {
        console.warn("Failed to parse sign-out error response:", payload.message);
      }
      setState({
        error:
          payload instanceof Error
            ? "Failed to sign out."
            : (payload?.detail ?? "Failed to sign out."),
        isPending: false,
      });
      return;
    }

    router.push("/login");
    router.refresh();
    setState({ error: null, isPending: false });
  }, [router]);

  const actions = useMemo(() => ({ signOut }), [signOut]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <SignOutContext value={value}>{children}</SignOutContext>;
}

function useSignOutContext() {
  const context = use(SignOutContext);
  if (!context) {
    throw new Error("SignOut compound components must be used within a SignOut.Provider");
  }
  return context;
}

function SignOutButtonInner() {
  const {
    state,
    actions: { signOut },
  } = useSignOutContext();

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={state.isPending}
      {...stylex.props(styles.dangerButton)}
    >
      {state.isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}

function SignOutError() {
  const { state } = useSignOutContext();

  if (!state.error) return null;

  return <p {...stylex.props(styles.errorText)}>{state.error}</p>;
}

const SignOut = {
  Provider: SignOutProvider,
  Button: SignOutButtonInner,
  Error: SignOutError,
} as const;

export function SignOutButton() {
  return (
    <SignOut.Provider>
      <div {...stylex.props(styles.gap)}>
        <SignOut.Button />
        <SignOut.Error />
      </div>
    </SignOut.Provider>
  );
}
