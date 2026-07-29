import { Hono } from "hono";
import { generateWebDeveloperToken } from "../../shared/apple-music/token";
import { requireAuthMiddleware, rateLimitByUser } from "../../shared/middleware";
import type { Env } from "../../shared/types/env";

const appleMusic = new Hono<Env>().get(
  "/api/apple-music/token",
  requireAuthMiddleware(),
  rateLimitByUser("APPLE_MUSIC_TOKEN_RATE_LIMITER"),
  async (c) => {
    const developerToken = await generateWebDeveloperToken(
      [c.env.APP_FRONTEND_URL].filter((o) => o !== ""),
    );
    c.header("Cache-Control", "no-store");
    return c.json({ developerToken });
  },
);

export { appleMusic };
