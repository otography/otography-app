import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { DbError } from "@repo/errors";
import { csrfProtection, requireAuthMiddleware, rateLimitByUser } from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import type { Cursor } from "../../shared/pagination";
import { formatErrorResponse } from "../../shared/errors/error-response";
import { songCreateBodySchema } from "./model";
import { getSong, getSongs, registerSong, syncSong } from "./usecase";

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

const songCreateValidator = arktypeValidator("json", songCreateBodySchema, (result, c) => {
  if (!result.success) {
    return problemResponse(
      c,
      400,
      "bad-request",
      "Bad Request",
      "Please provide a valid song payload.",
    );
  }
});

const songIdParamSchema = type({
  id: "string.uuid",
});

const songIdParamValidator = arktypeValidator("param", songIdParamSchema, (result, c) => {
  if (!result.success) {
    return problemResponse(c, 400, "bad-request", "Bad Request", "Please provide a valid song id.");
  }
});

const songs = new Hono<{ Bindings: Bindings }>()
  .get("/api/songs", async (c) => {
    const limitParam = c.req.query("limit");
    const cursorCreatedAt = c.req.query("cursor[createdAt]");
    const cursorId = c.req.query("cursor[id]");

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    let cursor: Cursor | undefined;
    if (cursorCreatedAt && cursorId) {
      cursor = { createdAt: cursorCreatedAt, id: cursorId };
    }

    const result = await getSongs({ limit, cursor });
    if (result instanceof DbError) {
      const { body, statusCode } = formatErrorResponse(result);
      return c.body(JSON.stringify(body), statusCode, {
        "Content-Type": "application/problem+json",
      });
    }
    return c.json(result);
  })
  .get("/api/songs/:id", songIdParamValidator, async (c) => {
    const { id } = c.req.valid("param");

    const result = await getSong(id);
    if (result instanceof DbError) {
      const { body, statusCode } = formatErrorResponse(result);
      return c.body(JSON.stringify(body), statusCode, {
        "Content-Type": "application/problem+json",
      });
    }

    return c.json(result);
  })
  .post(
    "/api/songs",
    csrfProtection(),
    requireAuthMiddleware(),
    rateLimitByUser("CONTENT_RATE_LIMITER"),
    songCreateValidator,
    async (c) => {
      const payload = c.req.valid("json");
      const result = await registerSong(payload);

      if (result instanceof DbError) {
        const { body, statusCode } = formatErrorResponse(result);
        return c.body(JSON.stringify(body), statusCode, {
          "Content-Type": "application/problem+json",
        });
      }

      return c.json(result, 201);
    },
  )
  .patch(
    "/api/songs/:id",
    csrfProtection(),
    requireAuthMiddleware(),
    songIdParamValidator,
    async (c) => {
      const { id } = c.req.valid("param");
      const result = await syncSong(id);

      if (result instanceof DbError) {
        const { body, statusCode } = formatErrorResponse(result);
        return c.body(JSON.stringify(body), statusCode, {
          "Content-Type": "application/problem+json",
        });
      }

      return c.json(result);
    },
  );

export { songs };
