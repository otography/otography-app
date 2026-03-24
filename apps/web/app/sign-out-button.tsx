"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { env } from "@/src/env";

export function SignOutButton() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	const signOut = async () => {
		setError(null);
		setIsPending(true);

		try {
			const response = await fetch(new URL("/api/auth/sign-out", env.NEXT_PUBLIC_API_URL), {
				method: "POST",
				credentials: "include",
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as { message?: string } | null;
				setError(payload?.message ?? "Failed to sign out.");
				return;
			}

			router.push("/login");
			router.refresh();
		} catch {
			setError("Unable to reach the authentication API.");
		} finally {
			setIsPending(false);
		}
	};

	return (
		<div style={{ display: "grid", gap: "0.75rem" }}>
			<button
				type="button"
				onClick={() => void signOut()}
				disabled={isPending}
				style={{ padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "1px solid #d6d6d6" }}
			>
				{isPending ? "Signing out..." : "Sign out"}
			</button>
			{error ? <p style={{ margin: 0, color: "#b00020" }}>{error}</p> : null}
		</div>
	);
}
