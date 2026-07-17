import { Hono } from "hono";
import { cache } from "hono/cache";
import { generateDeveloperToken } from "../../shared/apple-music/token";
import type { Env } from "../../shared/types/env";

const appleMusic = new Hono<Env>().get(
  "/api/apple-music/token",
  cache({
    cacheName: "apple-music-token",
    cacheControl: "public, s-maxage=82800", // 23h（token TTL 24h - margin 1h）
  }),
  async (c) => {
    const developerToken = await generateDeveloperToken();
    return c.json({ developerToken });
  },
);

export { appleMusic };
