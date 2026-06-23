"use client";

import { type ReactNode, use } from "react";
import * as stylex from "@stylexjs/stylex";
import { Field, Form } from "@formisch/react";
import { AuthContext } from "../auth-context";
import { AuthProvider } from "../auth-provider";
import { shared } from "@/styles/shared.stylex";

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
    <Form of={state.form} onSubmit={actions.signIn} {...stylex.props(shared.formGrid)}>
      {children}
    </Form>
  );
}

function AuthSignUpFrame({ children }: { children: ReactNode }) {
  const { state, actions } = useAuthContext();

  return (
    <Form of={state.form} onSubmit={actions.signUp} {...stylex.props(shared.formGrid)}>
      {children}
    </Form>
  );
}

function AuthEmailField() {
  const { state } = useAuthContext();

  return (
    <Field of={state.form} path={["email"]}>
      {(field) => (
        <div {...stylex.props(shared.fieldGroup)}>
          <label>
            <span>Email</span>
            <input
              {...field.props}
              type="email"
              autoComplete="email"
              aria-invalid={field.errors ? true : undefined}
              aria-describedby={field.errors ? "email-error" : undefined}
              {...stylex.props(shared.input)}
            />
          </label>
          {field.errors && (
            <p id="email-error" {...stylex.props(shared.errorText)}>
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
        <div {...stylex.props(shared.fieldGroup)}>
          <label>
            <span>Password</span>
            <input
              {...field.props}
              type="password"
              autoComplete="current-password"
              aria-invalid={field.errors ? true : undefined}
              aria-describedby={field.errors ? "password-error" : undefined}
              {...stylex.props(shared.input)}
            />
          </label>
          {field.errors && (
            <p id="password-error" {...stylex.props(shared.errorText)}>
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

  return <p {...stylex.props(shared.errorText)}>{meta.displayedError}</p>;
}

function AuthSubmitButton() {
  const { state } = useAuthContext();

  return (
    <button type="submit" disabled={state.isPending} {...stylex.props(shared.submitButton)}>
      {state.isPending ? "Signing in..." : "Sign in"}
    </button>
  );
}

function AuthCreateAccountButton() {
  const { state } = useAuthContext();

  return (
    <button type="submit" disabled={state.isPending} {...stylex.props(shared.secondaryButton)}>
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
