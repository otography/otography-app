import { Hono } from "hono";
import { adminRoutes } from "./admin/routes.ts";
import { auth } from "./auth/auth.ts";
import { db } from "./lib/db.ts";
import { purgeExpired } from "./maintenance/usecases/purge-expired.ts";
import { type SessionEnv, sessionMiddleware } from "./auth/session.ts";
import { postsRoutes } from "./posts/routes.ts";
import { reportsRoutes } from "./reports/routes.ts";
import { musicRoutes } from "./songs/routes.ts";
import { usersRoutes } from "./users/routes.ts";
import { logError } from "./lib/log.ts";

// 機能ごとのルートをつなぐ。フォルダの構成は docs/adr/0011-organize-api-source-by-feature.md を参照。
const app = new Hono<SessionEnv>()
  // Better Auth の初期値のパス。Google ログインの開始・コールバック・ログアウトなどを扱う。
  // 公式の Hono 連携ガイドに従い、すべてのメソッドを渡す（メソッドの検証は Better Auth が行う）。
  // 下の sessionMiddleware より前に置くので、/api/auth/* ではセッションを二重に読まない。
  .all("/api/auth/*", (c) => auth.handler(c.req.raw))
  .use("/api/*", sessionMiddleware)
  .route("/api", usersRoutes)
  .route("/api/music", musicRoutes)
  .route("/api/posts", postsRoutes)
  .route("/api/reports", reportsRoutes)
  .route("/api/admin", adminRoutes);

export type AppType = typeof app;
export type { Auth } from "./auth/auth.ts";

export default {
  fetch: app.fetch,
  // Cron トリガー（cloudflare.config.ts）から 1 日 1 回呼ばれ、保存期間を過ぎた行を物理削除する。
  scheduled: async (controller) => {
    const purged = await purgeExpired({ db, now: new Date(controller.scheduledTime) });
    if (purged instanceof Error) {
      logError(purged);
      return;
    }
    console.log("期限を過ぎた行を物理削除しました", purged);
  },
} satisfies ExportedHandler;
