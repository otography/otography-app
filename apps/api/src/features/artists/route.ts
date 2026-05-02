import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { DbError } from "@repo/errors";
import { csrfProtection, requireAuthMiddleware } from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import { getArtist, getArtists, modifyArtist, registerArtist, removeArtist } from "./usecase";
import { artistCreateBodySchema, artistUpdateSchema } from "./model";

const handleArtistError = (error: DbError, c: Context<{ Bindings: Bindings }>) => {
  return c.json({ message: error.message }, error.statusCode);
};

const artistCreateValidator = arktypeValidator("json", artistCreateBodySchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: "Please provide a valid artist payload." }, 400);
  }
});

const artistIdParamSchema = type({
  id: "string.uuid",
});

const artistIdParamValidator = arktypeValidator("param", artistIdParamSchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: "Please provide a valid artist id." }, 400);
  }
});

const artistUpdateBodyValidator = arktypeValidator("json", artistUpdateSchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: "Please provide a valid artist payload." }, 400);
  }
});

const artists = new Hono<{ Bindings: Bindings }>()
  .get("/api/artists", async (c) => {
    const result = await getArtists();
    if (result instanceof DbError) return handleArtistError(result, c);
    return c.json(result);
  })
  .get("/api/artists/:id", artistIdParamValidator, async (c) => {
    const { id } = c.req.valid("param");

    const result = await getArtist(id);
    if (result instanceof DbError) return handleArtistError(result, c);

    return c.json(result);
  })
  .post(
    "/api/artists",
    csrfProtection(),
    requireAuthMiddleware(),
    artistCreateValidator,
    async (c) => {
      const payload = c.req.valid("json");
      const result = await registerArtist(payload);
      if (result instanceof DbError) return handleArtistError(result, c);

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
        return c.json({ message: "Please provide at least one field to update." }, 400);
      }
      const result = await modifyArtist({
        id,
        payload,
      });
      if (result instanceof DbError) return handleArtistError(result, c);

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
      if (result instanceof DbError) return handleArtistError(result, c);

      return c.body(null, 204);
    },
  );

export { artists };
