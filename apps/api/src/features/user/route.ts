import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { AuthError } from "@repo/errors/server";
import { csrfProtection, requireAuthMiddleware, getAuthSession } from "../../shared/middleware";
import { errorLogFields } from "../../shared/logging/redaction";
import { problemResponse, respondWithError } from "../../shared/errors/error-response";
import type { Bindings } from "../../shared/types/bindings";
import { setupProfileSchema, updateUserSchema } from "../../shared/db/schema";
import {
  getProfile,
  setupProfile,
  updateProfile,
  deleteAccount,
  getPublicProfile,
} from "./usecase";

const handleUserError = (error: AuthError, c: Context<{ Bindings: Bindings }>) => {
  console.warn("User route returned error.", {
    path: c.req.path,
    ...errorLogFields(error),
  });
  return respondWithError(error, c);
};

const user = new Hono<{ Bindings: Bindings }>()
  // 自分のプロフィール取得
  .get("/api/user", requireAuthMiddleware(), async (c) => {
    const session = getAuthSession(c);
    if (!session) {
      console.warn("GET /api/user reached without auth session.");
      return problemResponse(c, 401, "unauthorized", "Unauthorized", "You are not logged in.");
    }
    console.info("GET /api/user started.", { hasEmail: Boolean(session.email) });
    const result = await getProfile(session);
    if (result instanceof Error) return handleUserError(result, c);
    console.info("GET /api/user succeeded.", {
      hasName: Boolean(result.profile.name),
    });
    return c.json({ message: "You are logged in!", profile: result.profile }, 200);
  })

  // 初回プロフィール設定（username, name）
  .patch(
    "/api/user/profile",
    csrfProtection(),
    requireAuthMiddleware(),
    arktypeValidator("json", setupProfileSchema, (result, c) => {
      if (!result.success) {
        return problemResponse(c, 400, "bad-request", "Bad Request", "Invalid profile data.");
      }
    }),
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return problemResponse(c, 401, "unauthorized", "Unauthorized", "You are not logged in.");
      }
      const values = c.req.valid("json");
      const result = await setupProfile(session, values);
      if (result instanceof Error) return handleUserError(result, c);
      return c.json({ message: "Profile updated.", profile: result.profile }, 200);
    },
  )

  // プロフィール詳細更新（bio, birthplace, birthyear, gender, name）
  .patch(
    "/api/user",
    csrfProtection(),
    requireAuthMiddleware(),
    arktypeValidator("json", updateUserSchema, (result, c) => {
      if (!result.success) {
        return problemResponse(c, 400, "bad-request", "Bad Request", "Invalid profile data.");
      }
    }),
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return problemResponse(c, 401, "unauthorized", "Unauthorized", "You are not logged in.");
      }
      const values = c.req.valid("json");
      const result = await updateProfile(session, values);
      if (result instanceof Error) return handleUserError(result, c);
      return c.json({ message: "Profile updated.", profile: result.profile }, 200);
    },
  )

  // アカウント削除（論理削除）
  .delete("/api/user", csrfProtection(), requireAuthMiddleware(), async (c) => {
    const session = getAuthSession(c);
    if (!session) {
      return problemResponse(c, 401, "unauthorized", "Unauthorized", "You are not logged in.");
    }
    const result = await deleteAccount(session);
    if (result instanceof Error) return handleUserError(result, c);
    return c.json({ message: "Account deleted." }, 200);
  })

  // 公開プロフィール取得
  .get("/api/users/:username", async (c) => {
    const { username } = c.req.param();
    const result = await getPublicProfile(username);
    if (result instanceof Error) return handleUserError(result, c);
    return c.json(result, 200);
  });

export { user };
