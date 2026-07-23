import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { csrfProtection, requireAuthMiddleware, rateLimitByUser } from "../../shared/middleware";
import type { Env } from "../../shared/types/env";
import { parsePaginationQuery } from "../../shared/pagination";
import { badRequestResponse, respondWithError } from "../../shared/errors/error-response";
import { songCreateBodySchema } from "./model";
import { getSong, getSongs, registerSong, syncSong } from "./usecase";

const songCreateValidator = arktypeValidator("json", songCreateBodySchema, (result, c) => {
  if (!result.success) {
    return badRequestResponse(c, "Please provide a valid song payload.");
  }
});

const songIdParamSchema = type({
  id: "string.uuid",
});

const songIdParamValidator = arktypeValidator("param", songIdParamSchema, (result, c) => {
  if (!result.success) {
    return badRequestResponse(c, "Please provide a valid song id.");
  }
});

const songs = new Hono<Env>()
  .get("/api/songs", async (c) => {
    const pagination = parsePaginationQuery(c);
    if (pagination instanceof type.errors) {
      return badRequestResponse(c, "Please provide valid pagination parameters.");
    }

    const result = await getSongs(pagination, c.var.db());
    if (result instanceof Error) return respondWithError(result, c);
    return c.json(result);
  })
  .get("/api/songs/:id", songIdParamValidator, async (c) => {
    const { id } = c.req.valid("param");

    const result = await getSong(id, c.var.db());
    if (result instanceof Error) return respondWithError(result, c);

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
      const result = await registerSong(payload, c.var.db());

      if (result instanceof Error) return respondWithError(result, c);

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
      const result = await syncSong(id, c.var.db());

      if (result instanceof Error) return respondWithError(result, c);

      return c.json(result);
    },
  );

export { songs };
