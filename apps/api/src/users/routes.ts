import { Hono } from "hono";
import { requireAuth, type SessionEnv } from "../auth/session.ts";
import { meSchema } from "./schemas.ts";

export const usersRoutes = new Hono<SessionEnv>()
  // SPA は、200 ならログイン中、401 なら未ログインと判断する。
  .get("/me", requireAuth, (c) => c.json(meSchema.parse(c.get("user"))));
