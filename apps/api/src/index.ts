import { Hono } from "hono";
import { auth } from "./auth.ts";
import { requireAuth, type SessionEnv, sessionMiddleware } from "./middleware/session.ts";

const app = new Hono<SessionEnv>()
  // Better Auth の初期値のパス。Google ログインの開始・コールバック・ログアウトなどを扱う。
  // 公式の Hono 連携ガイドに従い、すべてのメソッドを渡す（メソッドの検証は Better Auth が行う）。
  // 下の sessionMiddleware より前に置くので、/api/auth/* ではセッションを二重に読まない。
  .all("/api/auth/*", (c) => auth.handler(c.req.raw))
  .use("/api/*", sessionMiddleware)
  // SPA は、200 ならログイン中、401 なら未ログインと判断する。
  .get("/api/me", requireAuth, (c) => {
    const user = c.get("user")!;
    return c.json({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      publicId: user.publicId,
      bio: user.bio ?? null,
    });
  });

export type AppType = typeof app;
export type { Auth } from "./auth.ts";

export default app;
