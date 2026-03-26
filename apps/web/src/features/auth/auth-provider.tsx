"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { env } from "@/env";
import { api } from "@/lib/api";
import {
	type AuthActions,
	type AuthContextValue,
	type AuthMeta,
	type AuthState,
	AuthContext,
} from "./auth-context";

function getInitialAuthState(): AuthState {
	return {
		email: "",
		password: "",
		error: null,
		pendingMode: null,
	};
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [state, setState] = useState<AuthState>(getInitialAuthState);

	const submit = useCallback(
		async (mode: "sign-in" | "sign-up") => {
			setState((prev) => ({ ...prev, pendingMode: mode, error: null }));

			try {
				const response =
					mode === "sign-in"
						? await api.auth["sign-in"].$post({
								json: { email: state.email, password: state.password },
							})
						: await api.auth["sign-up"].$post({
								json: { email: state.email, password: state.password },
							});

				if (!response.ok) {
					const payload = (await response.json().catch(() => null)) as { message?: string } | null;
					setState((prev) => ({
						...prev,
						error: payload?.message ?? "Authentication failed.",
						pendingMode: null,
					}));
					return;
				}

				if (mode === "sign-up") {
					await api.user.$get();
				}

				router.push("/account");
				router.refresh();
			} catch {
				setState((prev) => ({
					...prev,
					error: "Unable to reach the authentication API.",
					pendingMode: null,
				}));
			} finally {
				setState((prev) => ({ ...prev, pendingMode: null }));
			}
		},
		[router, state.email, state.password],
	);

	const actions: AuthActions = useMemo(
		() => ({
			update: setState,
			signIn: () => submit("sign-in"),
			signUp: () => submit("sign-up"),
		}),
		[submit],
	);

	const meta: AuthMeta = useMemo(
		() => ({
			displayedError: state.error ?? searchParams.get("error"),
			googleAuthUrl: new URL("/api/auth/oauth/google/start", env.NEXT_PUBLIC_API_URL).toString(),
			appleAuthUrl: new URL("/api/auth/oauth/apple/start", env.NEXT_PUBLIC_API_URL).toString(),
		}),
		[state.error, searchParams],
	);

	const value: AuthContextValue = useMemo(() => ({ state, actions, meta }), [state, actions, meta]);

	return <AuthContext value={value}>{children}</AuthContext>;
}
