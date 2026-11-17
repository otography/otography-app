import { env } from "cloudflare:workers";
import { createMiddleware } from "hono/factory";
import type { SessionUser } from "../../auth/session.ts";
import { RateLimitCheckError } from "./errors.ts";

/** cloudflare.config.ts で宣言した回数制限のバインディング。 */
type Limiter = "WRITE_RATE_LIMIT" | "LIKE_RATE_LIMIT" | "READ_RATE_LIMIT";

/**
 * ログイン中のユーザーごとに回数を制限する。requireAuth の後に使う。上限を超えたら 429 を返す。
 * 回数制限の仕組みが失敗したときは、ログに残して通す（回数制限のために API を止めない）。
 */
export const rateLimit = (limiter: Limiter) =>
  createMiddleware<{ Variables: { user: SessionUser } }>(async (c, next) => {
    const outcome = await env[limiter]
      .limit({ key: c.get("user").id })
      .catch((e) => new RateLimitCheckError({ limiter, cause: e }));
    if (outcome instanceof Error) {
      console.warn(outcome.message, outcome.cause);
      return next();
    }
    if (!outcome.success) {
      return c.json({ error: "操作が多すぎます。1 分ほど待ってから、もう一度試してください" }, 429);
    }
    return next();
  });
