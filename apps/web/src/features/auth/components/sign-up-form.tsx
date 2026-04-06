"use client";

import { Auth } from "./auth";

export function SignUpForm() {
  return (
    <Auth.Provider>
      <Auth.SignUpFrame>
        <Auth.EmailField />
        <Auth.PasswordField />
        <Auth.Error />
        <Auth.CreateAccountButton />
      </Auth.SignUpFrame>
    </Auth.Provider>
  );
}
