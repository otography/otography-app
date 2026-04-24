import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { DbError } from "@repo/errors";
import { csrfProtection, requireAuthMiddleware } from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import { getSong, getSongs, registerSong } from "./usecase";
import { songInsertSchema } from "./model";

const handleSongError = (error: DbError, c: Context<{ Bindings: Bindings }>) => {
  return c.json({ message: error.message }, error.statusCode);
};

const songBodyValidator = arktypeValidator("json", songInsertSchema, (result, c) => {
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
  .post("/api/songs", csrfProtection(), requireAuthMiddleware(), songBodyValidator, async (c) => {
    const payload = c.req.valid("json");
    const result = await registerSong(payload);

    if (result instanceof Error) return handleSongError(result, c);

    return c.json(result, 201);
  });

export { songs };
