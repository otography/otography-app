import { createMiddleware } from "hono/factory";
import { auth } from "./auth.ts";

type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];

export type SessionEnv = {
  Variables: {
    user: Session["user"] | null;
    session: Session["session"] | null;
  };
};

/** セッションを読み、c.var.user と c.var.session に入れる。利用停止中・退会済みのユーザーは未ログインとして扱う。 */
export const sessionMiddleware = createMiddleware<SessionEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  const active = result && !result.user.suspendedAt && !result.user.deletedAt;
  c.set("user", active ? result.user : null);
  c.set("session", active ? result.session : null);
  await next();
});

/**
 * 未ログインのリクエストに 401 を返す。sessionMiddleware の後に使う。
 * この後のハンドラーでは、c.var.user と c.var.session が null でない型になる。
 */
export const requireAuth = createMiddleware<{
  Variables: { user: SessionUser; session: Session["session"] };
}>(async (c, next) => {
  if (!c.get("user")) return c.json({ error: "unauthorized" }, 401);
  await next();
});
