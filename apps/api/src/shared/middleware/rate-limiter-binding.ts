import type { Env } from "../types/env";

/** レートリミットバインディングの呼び出しインターフェース */
interface RateLimiterBinding {
  limit: (opts: { key: string }) => Promise<{ success: boolean }>;
}

// Bindings から指定名のレートリミッターを取得する。未設定・不正な形状ならErrorを返す。
export const getRateLimiter = (bindings: Env["Bindings"], limiterName: string) => {
  const binding: unknown = (bindings as Record<string, unknown>)[limiterName];
  if (
    typeof binding !== "object" ||
    binding === null ||
    !("limit" in binding) ||
    typeof binding.limit !== "function"
  ) {
    return new Error(`Rate limiter binding ${limiterName} is not configured.`);
  }
  return binding as RateLimiterBinding;
};
