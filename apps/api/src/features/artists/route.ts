import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { csrfProtection, requireAuthMiddleware, rateLimitByUser } from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import type { Cursor } from "../../shared/pagination";
import { badRequestResponse, respondWithError } from "../../shared/errors/error-response";
import { getArtist, getArtists, modifyArtist, registerArtist, removeArtist } from "./usecase";
import { artistCreateBodySchema, artistUpdateSchema } from "./model";

const artistCreateValidator = arktypeValidator("json", artistCreateBodySchema, (result, c) => {
  if (!result.success) {
    return badRequestResponse(c, "Please provide a valid artist payload.");
  }
});

const artistIdParamSchema = type({
  id: "string.uuid",
});

const artistIdParamValidator = arktypeValidator("param", artistIdParamSchema, (result, c) => {
  if (!result.success) {
    return badRequestResponse(c, "Please provide a valid artist id.");
  }
});

const artistUpdateBodyValidator = arktypeValidator("json", artistUpdateSchema, (result, c) => {
  if (!result.success) {
    return badRequestResponse(c, "Please provide a valid artist payload.");
  }
});

const artists = new Hono<{ Bindings: Bindings }>()
  .get("/api/artists", async (c) => {
    const limitParam = c.req.query("limit");
    const cursorCreatedAt = c.req.query("cursor[createdAt]");
    const cursorId = c.req.query("cursor[id]");

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    let cursor: Cursor | undefined;
    if (cursorCreatedAt && cursorId) {
      cursor = { createdAt: cursorCreatedAt, id: cursorId };
    }

    const result = await getArtists({ limit, cursor });
    if (result instanceof Error) return respondWithError(result, c);
    return c.json(result);
  })
  .get("/api/artists/:id", artistIdParamValidator, async (c) => {
    const { id } = c.req.valid("param");

    const result = await getArtist(id);
    if (result instanceof Error) return respondWithError(result, c);

    return c.json(result);
  })
  .post(
    "/api/artists",
    csrfProtection(),
    requireAuthMiddleware(),
    rateLimitByUser("CONTENT_RATE_LIMITER"),
    artistCreateValidator,
    async (c) => {
      const payload = c.req.valid("json");
      const result = await registerArtist(payload);
      if (result instanceof Error) return respondWithError(result, c);

      return c.json(result, 201);
    },
  )
  .patch(
    "/api/artists/:id",
    csrfProtection(),
    requireAuthMiddleware(),
    artistIdParamValidator,
    artistUpdateBodyValidator,
    async (c) => {
      const { id } = c.req.valid("param");
      const payload = c.req.valid("json");
      if (Object.keys(payload).length === 0) {
        return badRequestResponse(c, "Please provide at least one field to update.");
      }
      const result = await modifyArtist({
        id,
        payload,
      });
      if (result instanceof Error) return respondWithError(result, c);

      return c.json(result);
    },
  )
  .delete(
    "/api/artists/:id",
    csrfProtection(),
    requireAuthMiddleware(),
    artistIdParamValidator,
    async (c) => {
      const { id } = c.req.valid("param");

      const result = await removeArtist(id);
      if (result instanceof Error) return respondWithError(result, c);

      return c.body(null, 204);
    },
  );

export { artists };
