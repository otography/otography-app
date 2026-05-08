import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { formatErrorResponse } from "../../shared/errors/error-response";
import {
  csrfProtection,
  getAuthSession,
  rateLimitByUser,
  requireAuthMiddleware,
} from "../../shared/middleware";
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
  rateLimitByUser("LIKE_RATE_LIMITER"),
  postIdParamValidator,
  async (c) => {
    // rateLimitByUser が未認証を弾くため、ここではsessionは必ず存在する
    const session = getAuthSession(c)!;
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
