import { Hono } from "hono";
import { getDeveloperToken } from "./apple-music/token.ts";
import { auth } from "./auth.ts";
import { requireAuth, type SessionEnv, sessionMiddleware } from "./middleware/session.ts";
import { meSchema } from "./schemas/user.ts";

const app = new Hono<SessionEnv>()
  // Better Auth の初期値のパス。Google ログインの開始・コールバック・ログアウトなどを扱う。
  // 公式の Hono 連携ガイドに従い、すべてのメソッドを渡す（メソッドの検証は Better Auth が行う）。
  // 下の sessionMiddleware より前に置くので、/api/auth/* ではセッションを二重に読まない。
  .all("/api/auth/*", (c) => auth.handler(c.req.raw))
  .use("/api/*", sessionMiddleware)
  // SPA は、200 ならログイン中、401 なら未ログインと判断する。
  .get("/api/me", requireAuth, (c) => c.json(meSchema.parse(c.get("user"))))
  // MusicKit JS（ブラウザでの曲の検索と試聴）に渡す開発者トークン。リクエストのオリジンでだけ使える。
  .get("/api/music/token", requireAuth, async (c) => {
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

export type AppType = typeof app;
export type { Auth } from "./auth.ts";

export default app;
