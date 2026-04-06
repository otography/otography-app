"use client";

import { createContext, type ReactNode, useCallback, use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

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

    try {
      const response = await api.auth["sign-out"].$post();

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setState({ error: payload?.message ?? "Failed to sign out.", isPending: false });
        return;
      }

      router.push("/login");
      router.refresh();
    } catch {
      setState({ error: "Unable to reach the authentication API.", isPending: false });
    } finally {
      setState((prev) => ({ ...prev, isPending: false }));
    }
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
      style={{ padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "1px solid #d6d6d6" }}
    >
      {state.isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}

function SignOutError() {
  const { state } = useSignOutContext();

  if (!state.error) return null;

  return <p style={{ margin: 0, color: "#b00020" }}>{state.error}</p>;
}

const SignOut = {
  Provider: SignOutProvider,
  Button: SignOutButtonInner,
  Error: SignOutError,
} as const;

export function SignOutButton() {
  return (
    <SignOut.Provider>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <SignOut.Button />
        <SignOut.Error />
      </div>
    </SignOut.Provider>
  );
}
