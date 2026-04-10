"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useForm } from "@formisch/react";
import { api } from "@/features/lib/api";
import {
  type AuthActions,
  type AuthContextValue,
  type AuthMeta,
  type AuthState,
  AuthContext,
} from "./auth-context";
import { AuthSchema } from "./schema";

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const form = useForm({ schema: AuthSchema });

  const signIn = useCallback(
    async (output: { email: string; password: string }) => {
      setIsPending(true);
      setError(null);

      const response = await api.auth["sign-in"]
        .$post({ json: output })
        .catch(() => new Error("Unable to reach the authentication API."));

      if (response instanceof Error) {
        setError(response.message);
        setIsPending(false);
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.message ?? "Authentication failed.");
        setIsPending(false);
        return;
      }

      router.push("/account");
      router.refresh();
      setIsPending(false);
    },
    [router],
  );

  const signUp = useCallback(
    async (output: { email: string; password: string }) => {
      setIsPending(true);
      setError(null);

      const response = await api.auth["sign-up"]
        .$post({ json: output })
        .catch(() => new Error("Unable to reach the authentication API."));

      if (response instanceof Error) {
        setError(response.message);
        setIsPending(false);
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.message ?? "Authentication failed.");
        setIsPending(false);
        return;
      }

      // サインアップ成功後、プロフィール設定ページへ
      router.push("/setup-profile");
      setIsPending(false);
    },
    [router],
  );

  const displayedError = error ?? searchParams.get("error");

  const value: AuthContextValue = useMemo(
    () => ({
      state: { form, error, isPending } satisfies AuthState,
      actions: { signIn, signUp } satisfies AuthActions,
      meta: { displayedError } satisfies AuthMeta,
    }),
    [form, error, isPending, signIn, signUp, displayedError],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
