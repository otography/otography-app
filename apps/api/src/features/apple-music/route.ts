import { Hono } from "hono";
import { generateWebDeveloperToken } from "../../shared/apple-music/token";
import { requireAuthMiddleware, rateLimitByUser } from "../../shared/middleware";
import { respondWithError } from "../../shared/errors/error-response";
import type { Env } from "../../shared/types/env";

const appleMusic = new Hono<Env>().get(
  "/api/apple-music/token",
  // センシティブなトークン応答をすべて no-store にする（401/429 エラー含む）
  async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  },
  requireAuthMiddleware(),
  rateLimitByUser("APPLE_MUSIC_TOKEN_RATE_LIMITER"),
  async (c) => {
    const result = await generateWebDeveloperToken(
      [c.env.APP_FRONTEND_URL].filter((o) => o !== ""),
    );
    if (result instanceof Error) {
      return respondWithError(result, c);
    }
    return c.json({ developerToken: result });
  },
);

export { appleMusic };
