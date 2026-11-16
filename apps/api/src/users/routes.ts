import { Hono } from "hono";
import { requireAuth, type SessionEnv } from "../auth/session.ts";
import { getMe } from "./usecases/get-me.ts";

export const usersRoutes = new Hono<SessionEnv>()
  // SPA は、200 ならログイン中、401 なら未ログインと判断する。
  .get("/me", requireAuth, (c) => {
    const me = getMe({ user: c.get("user") });
    if (me instanceof Error) {
      console.error(me);
      return c.json({ error: "ユーザーの情報を読み込めませんでした。再読み込みしてください" }, 500);
    }
    return c.json(me);
  });
