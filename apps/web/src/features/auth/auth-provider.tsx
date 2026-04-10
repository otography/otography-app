"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useForm } from "@formisch/react";
import { api } from "@/features/lib/api";
import {
  type AuthActions,
  type AuthContextValue,
  type AuthMeta,
  type AuthPendingMode,
  type AuthState,
  AuthContext,
} from "./auth-context";
import { AuthSchema } from "./schema";

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<AuthPendingMode | null>(null);

  const form = useForm({ schema: AuthSchema });

  const submit = useCallback(
    async (mode: AuthPendingMode, output: { email: string; password: string }) => {
      setPendingMode(mode);
      setError(null);

      try {
        const response =
          mode === "sign-in"
            ? await api.auth["sign-in"].$post({ json: output })
            : await api.auth["sign-up"].$post({ json: output });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          setError(payload?.message ?? "Authentication failed.");
          return;
        }

        // サインアップ成功後、プロフィール設定ページへ
        if (mode === "sign-up") {
          router.push("/setup-profile");
          return;
        }

        router.push("/account");
        router.refresh();
      } catch {
        setError("Unable to reach the authentication API.");
      } finally {
        setPendingMode(null);
      }
    },
    [router],
  );

  const signIn = useCallback(
    (output: { email: string; password: string }) => submit("sign-in", output),
    [submit],
  );

  const signUp = useCallback(
    (output: { email: string; password: string }) => submit("sign-up", output),
    [submit],
  );

  const displayedError = error ?? searchParams.get("error");

  const value: AuthContextValue = useMemo(
    () => ({
      state: { form, error, pendingMode } satisfies AuthState,
      actions: { signIn, signUp } satisfies AuthActions,
      meta: { displayedError } satisfies AuthMeta,
    }),
    [form, error, pendingMode, signIn, signUp, displayedError],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
