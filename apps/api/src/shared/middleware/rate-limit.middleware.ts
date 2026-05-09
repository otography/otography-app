import type { MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getConnInfo } from "hono/cloudflare-workers";
import { getAuthSession } from "../auth/auth-session";

/** レートリミットバインディングの呼び出しインターフェース */
interface RateLimiterBinding {
  limit: (opts: { key: string }) => Promise<{ success: boolean }>;
}

/**
 * RFC 7807 Problem Details 形式のエラーレスポンスを返すヘルパー
 */
const problemJson = (
  c: Parameters<MiddlewareHandler>[0],
  status: ContentfulStatusCode,
  typeSlug: string,
  title: string,
  detail: string,
) => {
  return c.body(
    JSON.stringify({
      type: `https://api.otography.com/errors/${typeSlug}`,
      title,
      status,
      detail,
    }),
    status,
    { "Content-Type": "application/problem+json" },
  );
};

/**
 * IPアドレスをキーとしたレートリミットミドルウェアファクトリ
 * getConnInfo(c).remote.address をキーに使用する
 */
export const rateLimitByIp = (limiterName: string): MiddlewareHandler => {
  return async (c, next) => {
    const ip = getConnInfo(c).remote.address ?? "unknown";
    const limiter = c.env[limiterName] as unknown as RateLimiterBinding;
    const { success } = await limiter.limit({ key: ip });

    if (!success) {
      return problemJson(
        c,
        429,
        "rate-limit-exceeded",
        "Rate Limit Exceeded",
        "Too many requests. Please try again later.",
      );
    }

    await next();
  };
};

/**
 * 認証ユーザーIDをキーとしたレートリミットミドルウェアファクトリ
 * getAuthSession(c)?.sub をキーに使用する（未認証時は401）
 */
export const rateLimitByUser = (limiterName: string): MiddlewareHandler => {
  return async (c, next) => {
    const session = getAuthSession(c) as { sub: string } | null;

    if (!session) {
      return problemJson(c, 401, "unauthorized", "Unauthorized", "You are not logged in.");
    }

    const limiter = c.env[limiterName] as unknown as RateLimiterBinding;
    const { success } = await limiter.limit({ key: session.sub });

    if (!success) {
      return problemJson(
        c,
        429,
        "rate-limit-exceeded",
        "Rate Limit Exceeded",
        "Too many requests. Please try again later.",
      );
    }

    await next();
  };
};
