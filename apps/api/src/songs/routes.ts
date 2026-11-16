import { Hono } from "hono";
import { requireAuth, type SessionEnv } from "../auth/session.ts";
import { getDeveloperToken } from "./apple-music/token.ts";

export const musicRoutes = new Hono<SessionEnv>()
  // MusicKit JS（ブラウザでの曲の検索と試聴）に渡す開発者トークン。リクエストのオリジンでだけ使える。
  .get("/token", requireAuth, async (c) => {
    const token = await getDeveloperToken({ origin: new URL(c.req.url).origin });
    if (token instanceof Error) {
      console.error(token);
      return c.json(
        { error: "Apple Music を使う準備ができませんでした。時間をおいて再読み込みしてください" },
        500,
      );
    }
    c.header("Cache-Control", "private, no-store");
    return c.json(token);
  });
