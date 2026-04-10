"use client";

import { type ReactNode, use } from "react";
import { Field, Form } from "@formisch/react";
import { AuthContext } from "../auth-context";
import { AuthProvider } from "../auth-provider";

function useAuthContext() {
  const context = use(AuthContext);
  if (!context) {
    throw new Error("Auth compound components must be used within an Auth.Provider");
  }
  return context;
}

function AuthSignInFrame({ children }: { children: ReactNode }) {
  const { state, actions } = useAuthContext();

  return (
    <Form of={state.form} onSubmit={actions.signIn} style={{ display: "grid", gap: "1rem" }}>
      {children}
    </Form>
  );
}

function AuthSignUpFrame({ children }: { children: ReactNode }) {
  const { state, actions } = useAuthContext();

  return (
    <Form of={state.form} onSubmit={actions.signUp} style={{ display: "grid", gap: "1rem" }}>
      {children}
    </Form>
  );
}

function AuthEmailField() {
  const { state } = useAuthContext();

  return (
    <Field of={state.form} path={["email"]}>
      {(field) => (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label>
            <span>Email</span>
            <input
              {...field.props}
              value={field.input}
              type="email"
              autoComplete="email"
              aria-invalid={field.errors ? true : undefined}
              aria-describedby={field.errors ? "email-error" : undefined}
              style={{
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #d6d6d6",
              }}
            />
          </label>
          {field.errors && (
            <p id="email-error" style={{ margin: 0, color: "#b00020" }}>
              {field.errors[0]}
            </p>
          )}
        </div>
      )}
    </Field>
  );
}

function AuthPasswordField() {
  const { state } = useAuthContext();

  return (
    <Field of={state.form} path={["password"]}>
      {(field) => (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label>
            <span>Password</span>
            <input
              {...field.props}
              value={field.input}
              type="password"
              autoComplete="current-password"
              aria-invalid={field.errors ? true : undefined}
              aria-describedby={field.errors ? "password-error" : undefined}
              style={{
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #d6d6d6",
              }}
            />
          </label>
          {field.errors && (
            <p id="password-error" style={{ margin: 0, color: "#b00020" }}>
              {field.errors[0]}
            </p>
          )}
        </div>
      )}
    </Field>
  );
}

function AuthError() {
  const { meta } = useAuthContext();

  if (!meta.displayedError) return null;

  return <p style={{ margin: 0, color: "#b00020" }}>{meta.displayedError}</p>;
}

function AuthSubmitButton() {
  const { state } = useAuthContext();

  return (
    <button
      type="submit"
      disabled={state.isPending}
      style={{ padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "none" }}
    >
      {state.isPending ? "Signing in..." : "Sign in"}
    </button>
  );
}

function AuthCreateAccountButton() {
  const { state } = useAuthContext();

  return (
    <button
      type="submit"
      disabled={state.isPending}
      style={{
        padding: "0.75rem 1rem",
        borderRadius: "0.5rem",
        border: "1px solid #d6d6d6",
        backgroundColor: "#ffffff",
      }}
    >
      {state.isPending ? "Creating..." : "Create account"}
    </button>
  );
}

export const Auth = {
  Provider: AuthProvider,
  SignInFrame: AuthSignInFrame,
  SignUpFrame: AuthSignUpFrame,
  EmailField: AuthEmailField,
  PasswordField: AuthPasswordField,
  Error: AuthError,
  SubmitButton: AuthSubmitButton,
  CreateAccountButton: AuthCreateAccountButton,
} as const;
