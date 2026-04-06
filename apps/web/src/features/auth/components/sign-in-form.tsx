"use client";

import { Auth } from "./auth";

export function SignInForm() {
  return (
    <Auth.Provider>
      <Auth.SignInFrame>
        <Auth.EmailField />
        <Auth.PasswordField />
        <Auth.Error />
        <Auth.SubmitButton />
      </Auth.SignInFrame>
    </Auth.Provider>
  );
}
