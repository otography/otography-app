import type { MiddlewareHandler } from "hono";
import { getConnInfo } from "hono/cloudflare-workers";
import { getAuthSession } from "../auth/auth-session";

/** レートリミットバインディングの呼び出しインターフェース */
interface RateLimiterBinding {
  limit: (opts: { key: string }) => Promise<{ success: boolean }>;
}

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
      return c.json({ message: "Too many requests. Please try again later." }, 429);
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
      return c.json({ message: "You are not logged in." }, 401);
    }

    const limiter = c.env[limiterName] as unknown as RateLimiterBinding;
    const { success } = await limiter.limit({ key: session.sub });

    if (!success) {
      return c.json({ message: "Too many requests. Please try again later." }, 429);
    }

    await next();
  };
};
