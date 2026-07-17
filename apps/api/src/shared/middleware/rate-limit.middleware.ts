import { createMiddleware } from "hono/factory";
import { getConnInfo } from "hono/cloudflare-workers";
import { getAuthSession } from "../auth/auth-session";
import { problemResponse, unauthorizedResponse } from "../errors/error-response";
import type { Env } from "../types/env";

/** レートリミットバインディングの呼び出しインターフェース */
interface RateLimiterBinding {
  limit: (opts: { key: string }) => Promise<{ success: boolean }>;
}

/**
 * IPアドレスをキーとしたレートリミットミドルウェアファクトリ
 * getConnInfo(c).remote.address をキーに使用する
 */
export const rateLimitByIp = (limiterName: string) =>
  createMiddleware<Env>(async (c, next) => {
    const ip = getConnInfo(c).remote.address ?? "unknown";
    const limiter = c.env[limiterName as keyof Env["Bindings"]] as unknown as RateLimiterBinding;
    const { success } = await limiter.limit({ key: ip });
    if (!success) {
      return problemResponse(
        c,
        "rate-limit-exceeded",
        "Too many requests. Please try again later.",
      );
    }

    await next();
  });

/**
 * 認証ユーザーIDをキーとしたレートリミットミドルウェアファクトリ
 * getAuthSession(c)?.sub をキーに使用する（未認証時は401）
 */
export const rateLimitByUser = (limiterName: string) =>
  createMiddleware<Env>(async (c, next) => {
    const session = getAuthSession(c) as { sub: string } | null;

    if (!session) {
      return unauthorizedResponse(c, "You are not logged in.");
    }

    const limiter = c.env[limiterName as keyof Env["Bindings"]] as unknown as RateLimiterBinding;
    const { success } = await limiter.limit({ key: session.sub });

    if (!success) {
      return problemResponse(
        c,
        "rate-limit-exceeded",
        "Too many requests. Please try again later.",
      );
    }

    await next();
  });
