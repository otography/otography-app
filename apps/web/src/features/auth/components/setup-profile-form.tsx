"use client";

import { createContext, type ReactNode, useCallback, use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface SetupProfileState {
  username: string;
  name: string;
  error: string | null;
  isPending: boolean;
}

interface SetupProfileActions {
  update: (updater: (state: SetupProfileState) => SetupProfileState) => void;
  submit: () => Promise<void>;
}

interface SetupProfileMeta {
  displayedError: string | null;
}

interface SetupProfileContextValue {
  state: SetupProfileState;
  actions: SetupProfileActions;
  meta: SetupProfileMeta;
}

const SetupProfileContext = createContext<SetupProfileContextValue | null>(null);

function SetupProfileProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SetupProfileState>({
    username: "",
    name: "",
    error: null,
    isPending: false,
  });

  const submit = useCallback(async () => {
    setState((prev) => ({ ...prev, isPending: true, error: null }));

    try {
      const response = await api.user.profile.$patch({
        json: { username: state.username, name: state.name },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setState((prev) => ({
          ...prev,
          error: payload?.message ?? "Failed to set up profile.",
          isPending: false,
        }));
        return;
      }

      router.push("/account");
      router.refresh();
    } catch {
      setState((prev) => ({
        ...prev,
        error: "Unable to reach the server.",
        isPending: false,
      }));
    } finally {
      setState((prev) => ({ ...prev, isPending: false }));
    }
  }, [router, state.username, state.name]);

  const actions = useMemo(() => ({ update: setState, submit }), [submit]);

  const meta = useMemo(() => ({ displayedError: state.error }), [state.error]);

  const value = useMemo(() => ({ state, actions, meta }), [state, actions, meta]);

  return <SetupProfileContext value={value}>{children}</SetupProfileContext>;
}

function useSetupProfileContext() {
  const context = use(SetupProfileContext);
  if (!context) {
    throw new Error("SetupProfile compound components must be used within a SetupProfile.Provider");
  }
  return context;
}

function SetupProfileFrame({ children }: { children: ReactNode }) {
  const {
    actions: { submit },
  } = useSetupProfileContext();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      style={{ display: "grid", gap: "1rem" }}
    >
      {children}
    </form>
  );
}

function SetupProfileUsernameField() {
  const {
    state,
    actions: { update },
  } = useSetupProfileContext();

  return (
    <label style={{ display: "grid", gap: "0.5rem" }}>
      <span>Username</span>
      <input
        type="text"
        value={state.username}
        onChange={(event) => update((s) => ({ ...s, username: event.target.value }))}
        required
        minLength={1}
        maxLength={50}
        style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #d6d6d6" }}
      />
    </label>
  );
}

function SetupProfileNameField() {
  const {
    state,
    actions: { update },
  } = useSetupProfileContext();

  return (
    <label style={{ display: "grid", gap: "0.5rem" }}>
      <span>Name</span>
      <input
        type="text"
        value={state.name}
        onChange={(event) => update((s) => ({ ...s, name: event.target.value }))}
        required
        maxLength={100}
        style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #d6d6d6" }}
      />
    </label>
  );
}

function SetupProfileError() {
  const { meta } = useSetupProfileContext();

  if (!meta.displayedError) return null;

  return <p style={{ margin: 0, color: "#b00020" }}>{meta.displayedError}</p>;
}

function SetupProfileSubmitButton() {
  const { state } = useSetupProfileContext();

  return (
    <button
      type="submit"
      disabled={state.isPending}
      style={{ padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "none" }}
    >
      {state.isPending ? "Setting up..." : "Set up profile"}
    </button>
  );
}

const SetupProfile = {
  Provider: SetupProfileProvider,
  Frame: SetupProfileFrame,
  UsernameField: SetupProfileUsernameField,
  NameField: SetupProfileNameField,
  Error: SetupProfileError,
  SubmitButton: SetupProfileSubmitButton,
} as const;

export function SetupProfileForm() {
  return (
    <SetupProfile.Provider>
      <SetupProfile.Frame>
        <SetupProfile.UsernameField />
        <SetupProfile.NameField />
        <SetupProfile.Error />
        <SetupProfile.SubmitButton />
      </SetupProfile.Frame>
    </SetupProfile.Provider>
  );
}
