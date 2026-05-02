import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { DbError } from "@repo/errors";
import { csrfProtection, requireAuthMiddleware } from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import { songCreateBodySchema, songSyncBodySchema } from "./model";
import { getSong, getSongs, registerSong, syncSong } from "./usecase";

const handleSongError = (error: DbError, c: Context<{ Bindings: Bindings }>) => {
  return c.json({ message: error.message }, error.statusCode);
};

const songCreateValidator = arktypeValidator("json", songCreateBodySchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: "Please provide a valid song payload." }, 400);
  }
});

const songIdParamSchema = type({
  id: "string.uuid",
});

const songIdParamValidator = arktypeValidator("param", songIdParamSchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: "Please provide a valid song id." }, 400);
  }
});

const songSyncValidator = arktypeValidator("json", songSyncBodySchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: "Please provide a valid song payload." }, 400);
  }
});

const songs = new Hono<{ Bindings: Bindings }>()
  .get("/api/songs", async (c) => {
    const result = await getSongs();
    if (result instanceof Error) return handleSongError(result, c);
    return c.json(result);
  })
  .get("/api/songs/:id", songIdParamValidator, async (c) => {
    const { id } = c.req.valid("param");

    const result = await getSong(id);
    if (result instanceof Error) return handleSongError(result, c);

    return c.json(result);
  })
  .post("/api/songs", csrfProtection(), requireAuthMiddleware(), songCreateValidator, async (c) => {
    const payload = c.req.valid("json");
    const result = await registerSong(payload);

    if (result instanceof Error) return handleSongError(result, c);

    return c.json(result, 201);
  })
  .patch(
    "/api/songs/:id",
    csrfProtection(),
    requireAuthMiddleware(),
    songIdParamValidator,
    songSyncValidator,
    async (c) => {
      const { id } = c.req.valid("param");
      const result = await syncSong(id);

      if (result instanceof Error) return handleSongError(result, c);

      return c.json(result);
    },
  );

export { songs };
