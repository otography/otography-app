import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import {
  badRequestResponse,
  respondWithError,
  unauthorizedResponse,
} from "../../shared/errors/error-response";
import {
  csrfProtection,
  getAuthSession,
  rateLimitByUser,
  requireAuthMiddleware,
} from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import type { Cursor } from "../../shared/pagination";
import { postInsertSchema, postUpdateSchema } from "./model";
import { getPost, getPosts, modifyPost, registerPost, removePost } from "./usecase";

const postBodyValidator = arktypeValidator("json", postInsertSchema, (result, c) => {
  if (!result.success) {
    return badRequestResponse(c, "Please provide a valid post payload.");
  }
});

const postIdParamSchema = type({
  id: "string.uuid",
});

const postIdParamValidator = arktypeValidator("param", postIdParamSchema, (result, c) => {
  if (!result.success) {
    return badRequestResponse(c, "Please provide a valid post id.");
  }
});

const postUpdateBodyValidator = arktypeValidator("json", postUpdateSchema, (result, c) => {
  if (!result.success) {
    return badRequestResponse(c, "Please provide a valid post payload.");
  }
});

const posts = new Hono<{ Bindings: Bindings }>()
  .get("/api/posts", async (c) => {
    const session = getAuthSession(c);

    const limitParam = c.req.query("limit");
    const cursorCreatedAt = c.req.query("cursor[createdAt]");
    const cursorId = c.req.query("cursor[id]");

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    let cursor: Cursor | undefined;
    if (cursorCreatedAt && cursorId) {
      cursor = { createdAt: cursorCreatedAt, id: cursorId };
    }

    const result = await getPosts(session, { limit, cursor });
    if (result instanceof Error) return respondWithError(result, c);

    return c.json(result);
  })
  .get("/api/posts/:id", postIdParamValidator, async (c) => {
    const { id } = c.req.valid("param");
    const session = getAuthSession(c);

    const result = await getPost(id, session);
    if (result instanceof Error) return respondWithError(result, c);

    return c.json(result);
  })
  .post(
    "/api/posts",
    csrfProtection(),
    requireAuthMiddleware(),
    rateLimitByUser("CONTENT_RATE_LIMITER"),
    postBodyValidator,
    async (c) => {
      // rateLimitByUser が未認証(401)を処理するため、ここでは session は非 null
      const session = getAuthSession(c)!;
      const payload = c.req.valid("json");

      const result = await registerPost(payload, session);
      if (result instanceof Error) return respondWithError(result, c);

      return c.json(result, 201);
    },
  )
  .patch(
    "/api/posts/:id",
    csrfProtection(),
    requireAuthMiddleware(),
    postIdParamValidator,
    postUpdateBodyValidator,
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return unauthorizedResponse(c, "You are not logged in.");
      }
      const { id } = c.req.valid("param");
      const payload = c.req.valid("json");
      if (Object.keys(payload).length === 0) {
        return badRequestResponse(c, "Please provide at least one field to update.");
      }

      const result = await modifyPost({ id, session, payload });
      if (result instanceof Error) return respondWithError(result, c);

      return c.json(result);
    },
  )
  .delete(
    "/api/posts/:id",
    csrfProtection(),
    requireAuthMiddleware(),
    postIdParamValidator,
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return unauthorizedResponse(c, "You are not logged in.");
      }
      const { id } = c.req.valid("param");
      const result = await removePost(id, session);
      if (result instanceof Error) return respondWithError(result, c);

      return c.body(null, 204);
    },
  );

export { posts };
