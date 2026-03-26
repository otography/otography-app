"use client";

import { Auth } from "./auth";

export function SignUpForm() {
	return (
		<Auth.Provider>
			<Auth.Frame>
				<Auth.EmailField />
				<Auth.PasswordField />
				<Auth.Error />
				<Auth.CreateAccountButton />
			</Auth.Frame>
		</Auth.Provider>
	);
}
