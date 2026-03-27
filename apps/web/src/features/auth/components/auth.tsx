"use client";

import { type ReactNode, use } from "react";
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
	const { actions } = useAuthContext();

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				void actions.signIn();
			}}
			style={{ display: "grid", gap: "1rem" }}
		>
			{children}
		</form>
	);
}

function AuthSignUpFrame({ children }: { children: ReactNode }) {
	const { actions } = useAuthContext();

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				void actions.signUp();
			}}
			style={{ display: "grid", gap: "1rem" }}
		>
			{children}
		</form>
	);
}

function AuthEmailField() {
	const {
		state,
		actions: { update },
	} = useAuthContext();

	return (
		<label style={{ display: "grid", gap: "0.5rem" }}>
			<span>Email</span>
			<input
				autoComplete="email"
				type="email"
				value={state.email}
				onChange={(event) => update((s) => ({ ...s, email: event.target.value }))}
				required
				style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #d6d6d6" }}
			/>
		</label>
	);
}

function AuthPasswordField() {
	const {
		state,
		actions: { update },
	} = useAuthContext();

	return (
		<label style={{ display: "grid", gap: "0.5rem" }}>
			<span>Password</span>
			<input
				autoComplete="current-password"
				type="password"
				value={state.password}
				onChange={(event) => update((s) => ({ ...s, password: event.target.value }))}
				required
				minLength={6}
				style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #d6d6d6" }}
			/>
		</label>
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
			disabled={state.pendingMode !== null}
			style={{ padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "none" }}
		>
			{state.pendingMode === "sign-in" ? "Signing in..." : "Sign in"}
		</button>
	);
}

function AuthCreateAccountButton() {
	const {
		state,
		actions: { signUp },
	} = useAuthContext();

	return (
		<button
			type="button"
			disabled={state.pendingMode !== null}
			onClick={() => void signUp()}
			style={{
				padding: "0.75rem 1rem",
				borderRadius: "0.5rem",
				border: "1px solid #d6d6d6",
				backgroundColor: "#ffffff",
			}}
		>
			{state.pendingMode === "sign-up" ? "Creating..." : "Create account"}
		</button>
	);
}

const oauthLinkStyle = (isPending: boolean) => ({
	display: "inline-flex",
	justifyContent: "center",
	padding: "0.75rem 1rem",
	borderRadius: "0.5rem",
	border: "1px solid #d6d6d6",
	color: "inherit",
	textDecoration: "none",
	backgroundColor: "#ffffff",
	pointerEvents: (isPending ? "none" : "auto") as "none" | "auto",
	opacity: isPending ? 0.6 : 1,
});

function AuthOAuthLinks() {
	const {
		state,
		meta: { googleAuthUrl, appleAuthUrl },
	} = useAuthContext();

	return (
		<div style={{ display: "grid", gap: "0.75rem" }}>
			<a href={googleAuthUrl} style={oauthLinkStyle(state.pendingMode !== null)}>
				Continue with Google
			</a>
			<a href={appleAuthUrl} style={oauthLinkStyle(state.pendingMode !== null)}>
				Continue with Apple
			</a>
		</div>
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
	OAuthLinks: AuthOAuthLinks,
} as const;
