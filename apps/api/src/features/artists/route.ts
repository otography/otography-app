import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { createInsertSchema, createUpdateSchema } from "drizzle-orm/arktype";
import { Hono } from "hono";
import { csrfProtection, requireAuthMiddleware } from "../../shared/middleware";
import { artists as artistsTable } from "../../shared/db/schema";
import type { Bindings } from "../../shared/types/bindings";
import {
  ArtistUsecaseError,
  getArtist,
  getArtists,
  modifyArtist,
  registerArtist,
  removeArtist,
} from "./usecase";

const artistBodySchema = createInsertSchema(artistsTable)
  .omit("id", "createdAt", "updatedAt", "deletedAt")
  .merge({
    name: type.pipe(type("string.trim"), type("string >= 1"), type("string <= 255")),
    "ipiCode?": type.pipe(type("string.trim"), type("string <= 20")),
    "type?": "'person' | 'group'",
    "gender?": type.pipe(type("string.trim"), type("string <= 20")),
    "birthplace?": type.pipe(type("string.trim"), type("string <= 100")),
    "birthdate?": "string",
  });

const artistBodyValidator = arktypeValidator("json", artistBodySchema, (result, c) => {
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

const artistUpdateBodySchema = createUpdateSchema(artistsTable)
  .omit("id", "createdAt", "updatedAt", "deletedAt")
  .merge({
    "name?": type.pipe(type("string.trim"), type("string >= 1"), type("string <= 255")),
    "ipiCode?": "string | null",
    "type?": "'person' | 'group' | null",
    "gender?": "string | null",
    "birthplace?": "string | null",
    "birthdate?": "string | null",
  });

const artistUpdateBodyValidator = arktypeValidator("json", artistUpdateBodySchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: "Please provide a valid artist payload." }, 400);
  }
});

const artists = new Hono<{ Bindings: Bindings }>()
  .get("/api/artists", async (c) => {
    const result = await getArtists();
    if (result instanceof ArtistUsecaseError) {
      return c.json({ message: result.message }, result.statusCode);
    }
    return c.json(result);
  })
  .get("/api/artists/:id", artistIdParamValidator, async (c) => {
    const { id } = c.req.valid("param");

    const result = await getArtist(id);
    if (result instanceof ArtistUsecaseError) {
      return c.json({ message: result.message }, result.statusCode);
    }

    return c.json(result);
  })
  .post(
    "/api/artists",
    csrfProtection(),
    requireAuthMiddleware(),
    artistBodyValidator,
    async (c) => {
      const payload = c.req.valid("json");
      const result = await registerArtist(payload);
      if (result instanceof ArtistUsecaseError) {
        return c.json({ message: result.message }, result.statusCode);
      }

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
      const result = await modifyArtist({
        id,
        payload,
      });
      if (result instanceof ArtistUsecaseError) {
        return c.json({ message: result.message }, result.statusCode);
      }

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
      if (result instanceof ArtistUsecaseError) {
        return c.json({ message: result.message }, result.statusCode);
      }

      return c.body(null, 204);
    },
  );

export { artists };
