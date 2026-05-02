import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { DbError } from "@repo/errors";
import { csrfProtection, getAuthSession, requireAuthMiddleware } from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import { toggleLike } from "./usecase";

const postIdParamSchema = type({
  id: "string.uuid",
});

const postIdParamValidator = arktypeValidator("param", postIdParamSchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: "Please provide a valid post id." }, 400);
  }
});

const postLikes = new Hono<{ Bindings: Bindings }>().post(
  "/api/posts/:id/like",
  csrfProtection(),
  requireAuthMiddleware(),
  postIdParamValidator,
  async (c) => {
    // レートリミット: ユーザーごとに30回/分
    const session = getAuthSession(c);
    if (!session) {
      return c.json({ message: "You are not logged in." }, 401);
    }

    const { success } = await c.env.LIKE_RATE_LIMITER.limit({ key: session.sub });
    if (!success) {
      return c.json({ message: "Too many requests. Please try again later." }, 429);
    }

    const { id } = c.req.valid("param");
    const result = await toggleLike(session, id);
    if (result instanceof Error) {
      const statusCode = result instanceof DbError ? result.statusCode : 500;
      return c.json({ message: result.message }, statusCode);
    }

    return c.json(result);
  },
);

export { postLikes };
