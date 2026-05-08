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

/**
 * RFC 7807 Problem Details 形式のバリデーションエラーレスポンスを返すヘルパー
 */
const problemResponse = (
  c: Context,
  statusCode: ContentfulStatusCode,
  typeSlug: string,
  title: string,
  detail: string,
) => {
  return c.body(
    JSON.stringify({
      type: `https://api.otography.com/errors/${typeSlug}`,
      title,
      status: statusCode,
      detail,
    }),
    statusCode,
    { "Content-Type": "application/problem+json" },
  );
};

const postIdParamSchema = type({
  id: "string.uuid",
});

const postIdParamValidator = arktypeValidator("param", postIdParamSchema, (result, c) => {
  if (!result.success) {
    return problemResponse(c, 400, "bad-request", "Bad Request", "Please provide a valid post id.");
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
      const { body, statusCode } = formatErrorResponse(result);
      return c.body(JSON.stringify(body), statusCode, {
        "Content-Type": "application/problem+json",
      });
    }

    return c.json(result);
  },
);

export { postLikes };
