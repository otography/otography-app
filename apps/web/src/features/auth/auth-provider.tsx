"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useForm } from "@formisch/react";
import { WebAuthClientError } from "@repo/errors";
import { api } from "@/features/lib/api";
import {
  type AuthActions,
  type AuthContextValue,
  type AuthMeta,
  type AuthState,
  AuthContext,
} from "./auth-context";
import { AuthSchema } from "./schema";

// OAuth エラーコード → 日本語メッセージのマッピング
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  account_exists:
    "このメールアドレスは既に別の方法で登録されています。元の方法でログインしてください。",
  invalid_state: "認証状態が無効です。もう一度お試しください。",
  expired_state: "ログインセッションが期限切れです。もう一度お試しください。",
  oauth_failed: "Googleログインに失敗しました。もう一度お試しください。",
  firebase_auth_failed: "認証に失敗しました。もう一度お試しください。",
  session_failed: "セッションの確立に失敗しました。もう一度お試しください。",
};

// OAuth エラーコードをユーザーフレンドリーなメッセージに変換
function resolveOAuthError(code: string): string {
  return (
    OAUTH_ERROR_MESSAGES[code] ?? "ログイン処理でエラーが発生しました。もう一度お試しください。"
  );
}

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

      const response = await api.auth["sign-in"].$post({ json: output }).catch(
        (e) =>
          new WebAuthClientError({
            message: "Unable to reach the authentication API.",
            cause: e,
          }),
      );

      if (response instanceof Error) {
        setError(response.message);
        setIsPending(false);
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(
          (e) =>
            new WebAuthClientError({
              message: "Failed to parse authentication error response.",
              cause: e,
            }),
        )) as WebAuthClientError | { message?: string } | null;
        if (payload instanceof Error) {
          console.warn("Failed to parse authentication error response:", payload.message);
        }
        setError(
          payload instanceof Error
            ? "Authentication failed."
            : (payload?.message ?? "Authentication failed."),
        );
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

      const response = await api.auth["sign-up"].$post({ json: output }).catch(
        (e) =>
          new WebAuthClientError({
            message: "Unable to reach the authentication API.",
            cause: e,
          }),
      );

      if (response instanceof Error) {
        setError(response.message);
        setIsPending(false);
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(
          (e) =>
            new WebAuthClientError({
              message: "Failed to parse authentication error response.",
              cause: e,
            }),
        )) as WebAuthClientError | { message?: string } | null;
        if (payload instanceof Error) {
          console.warn("Failed to parse authentication error response:", payload.message);
        }
        setError(
          payload instanceof Error
            ? "Authentication failed."
            : (payload?.message ?? "Authentication failed."),
        );
        setIsPending(false);
        return;
      }

      // サインアップ成功後、プロフィール設定ページへ
      router.push("/setup-profile");
      setIsPending(false);
    },
    [router],
  );

  // URL の ?error= パラメータをOAuthエラーマッピングで解決
  const urlErrorCode = searchParams.get("error");
  const resolvedUrlError = urlErrorCode ? resolveOAuthError(urlErrorCode) : null;
  const displayedError = error ?? resolvedUrlError;

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
