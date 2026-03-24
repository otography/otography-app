"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { env } from "@/env";
import { api } from "@/lib/api";

type AuthMode = "sign-in" | "sign-up";

export function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pendingMode, setPendingMode] = useState<AuthMode | null>(null);
	const displayedError = error ?? searchParams.get("error");
	const googleAuthUrl = new URL("/api/auth/oauth/google/start", env.NEXT_PUBLIC_API_URL).toString();
	const appleAuthUrl = new URL("/api/auth/oauth/apple/start", env.NEXT_PUBLIC_API_URL).toString();

	const submit = async (mode: AuthMode) => {
		setPendingMode(mode);
		setError(null);

		try {
			const response =
				mode === "sign-in"
					? await api.auth["sign-in"].$post({ json: { email, password } })
					: await api.auth["sign-up"].$post({ json: { email, password } });

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as { message?: string } | null;
				setError(payload?.message ?? "Authentication failed.");
				return;
			}

			// sign-up の場合はプロファイルを作成
			if (mode === "sign-up") {
				await api.user.$get();
			}

			router.push("/");
			router.refresh();
		} catch {
			setError("Unable to reach the authentication API.");
		} finally {
			setPendingMode(null);
		}
	};

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				void submit("sign-in");
			}}
			style={{ display: "grid", gap: "1rem" }}
		>
			<label style={{ display: "grid", gap: "0.5rem" }}>
				<span>Email</span>
				<input
					autoComplete="email"
					type="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					required
					style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #d6d6d6" }}
				/>
			</label>
			<label style={{ display: "grid", gap: "0.5rem" }}>
				<span>Password</span>
				<input
					autoComplete="current-password"
					type="password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					required
					minLength={6}
					style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #d6d6d6" }}
				/>
			</label>
			{displayedError ? <p style={{ margin: 0, color: "#b00020" }}>{displayedError}</p> : null}
			<div style={{ display: "flex", gap: "0.75rem" }}>
				<button
					type="submit"
					disabled={pendingMode !== null}
					style={{ padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "none" }}
				>
					{pendingMode === "sign-in" ? "Signing in..." : "Sign in"}
				</button>
				<button
					type="button"
					disabled={pendingMode !== null}
					onClick={() => void submit("sign-up")}
					style={{
						padding: "0.75rem 1rem",
						borderRadius: "0.5rem",
						border: "1px solid #d6d6d6",
						backgroundColor: "#ffffff",
					}}
				>
					{pendingMode === "sign-up" ? "Creating..." : "Create account"}
				</button>
			</div>
			<div style={{ display: "grid", gap: "0.75rem" }}>
				<a
					href={googleAuthUrl}
					style={{
						display: "inline-flex",
						justifyContent: "center",
						padding: "0.75rem 1rem",
						borderRadius: "0.5rem",
						border: "1px solid #d6d6d6",
						color: "inherit",
						textDecoration: "none",
						backgroundColor: "#ffffff",
						pointerEvents: pendingMode ? "none" : "auto",
						opacity: pendingMode ? 0.6 : 1,
					}}
				>
					Continue with Google
				</a>
				<a
					href={appleAuthUrl}
					style={{
						display: "inline-flex",
						justifyContent: "center",
						padding: "0.75rem 1rem",
						borderRadius: "0.5rem",
						border: "1px solid #d6d6d6",
						color: "inherit",
						textDecoration: "none",
						backgroundColor: "#ffffff",
						pointerEvents: pendingMode ? "none" : "auto",
						opacity: pendingMode ? 0.6 : 1,
					}}
				>
					Continue with Apple
				</a>
			</div>
		</form>
	);
}
