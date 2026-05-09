import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { badRequestResponse, respondWithError } from "../../shared/errors/error-response";
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
    return badRequestResponse(c, "Please provide a valid post id.");
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
    if (result instanceof Error) return respondWithError(result, c);

    return c.json(result);
  },
);

export { postLikes };
