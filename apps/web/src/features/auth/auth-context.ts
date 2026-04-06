import { createContext } from "react";

export type AuthMode = "sign-in" | "sign-up";

export interface AuthState {
  email: string;
  password: string;
  error: string | null;
  pendingMode: AuthMode | null;
}

export interface AuthActions {
  update: (updater: (state: AuthState) => AuthState) => void;
  signIn: () => Promise<void>;
  signUp: () => Promise<void>;
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
