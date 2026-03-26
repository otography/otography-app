"use client";

import { Auth } from "./auth";

export function AuthForm() {
	return (
		<Auth.Provider>
			<Auth.Frame>
				<Auth.EmailField />
				<Auth.PasswordField />
				<Auth.Error />
				<div style={{ display: "flex", gap: "0.75rem" }}>
					<Auth.SubmitButton />
					<Auth.CreateAccountButton />
				</div>
				<Auth.OAuthLinks />
			</Auth.Frame>
		</Auth.Provider>
	);
}
