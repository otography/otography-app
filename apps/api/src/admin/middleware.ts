import { createMiddleware } from "hono/factory";
import type { SessionUser } from "../auth/session.ts";
import { db } from "../lib/db.ts";
import { findIsAdmin } from "./repository.ts";
import { logError } from "../lib/log.ts";

/**
 * 管理者でなければ 403 を返す。requireAuth の後に使う。
 * 管理者かどうかはセッションのクッキーキャッシュではなく DB から読む（外した権限がすぐに効くように）。
 */
export const requireAdmin = createMiddleware<{ Variables: { user: SessionUser } }>(
  async (c, next) => {
    const isAdmin = await findIsAdmin({ db, userId: c.get("user").id });
    if (isAdmin instanceof Error) {
      logError(isAdmin);
      return c.json({ error: "管理者かどうかを確かめられませんでした" }, 500);
    }
    if (!isAdmin) return c.json({ error: "管理者だけが使えます" }, 403);
    return next();
  },
);
