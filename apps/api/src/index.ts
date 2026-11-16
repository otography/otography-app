import { Hono } from "hono";
import { auth } from "./auth/auth.ts";
import { type SessionEnv, sessionMiddleware } from "./auth/session.ts";
import { postsRoutes } from "./posts/routes.ts";
import { musicRoutes } from "./songs/routes.ts";
import { usersRoutes } from "./users/routes.ts";

// 機能ごとのルートをつなぐ。フォルダの構成は docs/adr/0011-organize-api-source-by-feature.md を参照。
const app = new Hono<SessionEnv>()
  // Better Auth の初期値のパス。Google ログインの開始・コールバック・ログアウトなどを扱う。
  // 公式の Hono 連携ガイドに従い、すべてのメソッドを渡す（メソッドの検証は Better Auth が行う）。
  // 下の sessionMiddleware より前に置くので、/api/auth/* ではセッションを二重に読まない。
  .all("/api/auth/*", (c) => auth.handler(c.req.raw))
  .use("/api/*", sessionMiddleware)
  .route("/api", usersRoutes)
  .route("/api/music", musicRoutes)
  .route("/api/posts", postsRoutes);

export type AppType = typeof app;
export type { Auth } from "./auth/auth.ts";

export default app;
