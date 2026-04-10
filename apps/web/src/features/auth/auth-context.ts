import { createContext } from "react";
import type { FormStore } from "@formisch/react";
import { AuthSchema } from "./schema";

export interface AuthState {
  form: FormStore<typeof AuthSchema>;
  error: string | null;
  isPending: boolean;
}

export interface AuthActions {
  signIn: (output: { email: string; password: string }) => Promise<void>;
  signUp: (output: { email: string; password: string }) => Promise<void>;
}

export interface AuthMeta {
  displayedError: string | null;
}

export interface AuthContextValue {
  state: AuthState;
  actions: AuthActions;
  meta: AuthMeta;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
