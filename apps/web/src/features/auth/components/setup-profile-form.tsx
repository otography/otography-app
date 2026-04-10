"use client";

import { createContext, type ReactNode, useCallback, use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Form, useForm } from "@formisch/react";
import type { FormStore } from "@formisch/react";
import { api } from "@/features/lib/api";
import * as v from "valibot";

const SetupProfileSchema = v.object({
  username: v.pipe(
    v.string("Please enter a username."),
    v.nonEmpty("Please enter a username."),
    v.maxLength(50, "Username must be 50 characters or fewer."),
  ),
  name: v.pipe(
    v.string("Please enter your name."),
    v.nonEmpty("Please enter your name."),
    v.maxLength(100, "Name must be 100 characters or fewer."),
  ),
});

interface SetupProfileState {
  form: FormStore<typeof SetupProfileSchema>;
}

interface SetupProfileActions {
  submit: (output: { username: string; name: string }) => Promise<void>;
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
  const [error, setError] = useState<string | null>(null);

  const form = useForm({ schema: SetupProfileSchema });

  const onSubmit = useCallback(
    async (output: { username: string; name: string }) => {
      setError(null);

      const response = await api.user.profile
        .$patch({ json: output })
        .catch(() => new Error("Unable to reach the server."));

      if (response instanceof Error) {
        setError(response.message);
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(payload?.message ?? "Failed to set up profile.");
        return;
      }

      router.push("/account");
      router.refresh();
    },
    [router],
  );

  const value = useMemo(
    () => ({
      state: { form },
      actions: { submit: onSubmit },
      meta: { displayedError: error },
    }),
    [form, onSubmit, error],
  );

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
  const { state, actions } = useSetupProfileContext();

  return (
    <Form of={state.form} onSubmit={actions.submit} style={{ display: "grid", gap: "1rem" }}>
      {children}
    </Form>
  );
}

function SetupProfileUsernameField() {
  const { state } = useSetupProfileContext();

  return (
    <Field of={state.form} path={["username"]}>
      {(field) => (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label>
            <span>Username</span>
            <input
              {...field.props}
              value={field.input}
              type="text"
              aria-invalid={field.errors ? true : undefined}
              aria-describedby={field.errors ? "username-error" : undefined}
              style={{
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #d6d6d6",
              }}
            />
          </label>
          {field.errors && (
            <p id="username-error" style={{ margin: 0, color: "#b00020" }}>
              {field.errors[0]}
            </p>
          )}
        </div>
      )}
    </Field>
  );
}

function SetupProfileNameField() {
  const { state } = useSetupProfileContext();

  return (
    <Field of={state.form} path={["name"]}>
      {(field) => (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label>
            <span>Name</span>
            <input
              {...field.props}
              value={field.input}
              type="text"
              aria-invalid={field.errors ? true : undefined}
              aria-describedby={field.errors ? "name-error" : undefined}
              style={{
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #d6d6d6",
              }}
            />
          </label>
          {field.errors && (
            <p id="name-error" style={{ margin: 0, color: "#b00020" }}>
              {field.errors[0]}
            </p>
          )}
        </div>
      )}
    </Field>
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
      disabled={state.form.isSubmitting}
      style={{ padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "none" }}
    >
      {state.form.isSubmitting ? "Setting up..." : "Set up profile"}
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
