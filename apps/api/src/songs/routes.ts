import { Hono } from "hono";
import { requireAuth, type SessionEnv } from "../auth/session.ts";
import { getDeveloperToken } from "../lib/apple-music/token.ts";
import { issueMusicKitToken } from "./usecases/issue-music-kit-token.ts";
import { logError } from "../lib/log.ts";

export const musicRoutes = new Hono<SessionEnv>()
  // MusicKit JS（ブラウザでの曲の検索と試聴）に渡す開発者トークン。リクエストのオリジンでだけ使える。
  .get("/token", requireAuth, async (c) => {
    const token = await issueMusicKitToken({
      origin: new URL(c.req.url).origin,
      getDeveloperToken,
    });
    if (token instanceof Error) {
      logError(token);
      return c.json(
        { error: "Apple Music を使う準備ができませんでした。時間をおいて再読み込みしてください" },
        500,
      );
    }
    c.header("Cache-Control", "private, no-store");
    return c.json(token);
  });
