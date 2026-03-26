"use client";

import { Auth } from "./auth";

export function SignInForm() {
	return (
		<Auth.Provider>
			<Auth.Frame>
				<Auth.EmailField />
				<Auth.PasswordField />
				<Auth.Error />
				<Auth.SubmitButton />
			</Auth.Frame>
		</Auth.Provider>
	);
}
