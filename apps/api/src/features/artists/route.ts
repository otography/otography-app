import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { csrfProtection, requireAuthMiddleware, rateLimitByUser } from "../../shared/middleware";
import type { Env } from "../../shared/types/env";
import { parsePaginationQuery } from "../../shared/pagination";
import { badRequestResponse, respondWithError } from "../../shared/errors/error-response";
import { getArtist, getArtists, registerArtist, syncArtist } from "./usecase";
import { artistCreateBodySchema } from "./model";

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

const artists = new Hono<Env>()
  .get("/api/artists", async (c) => {
    const pagination = parsePaginationQuery(c);
    if (pagination instanceof type.errors) {
      return badRequestResponse(c, "Please provide valid pagination parameters.");
    }

    const result = await getArtists(pagination, c.var.db());
    if (result instanceof Error) return respondWithError(result, c);
    return c.json(result);
  })
  .get("/api/artists/:id", artistIdParamValidator, async (c) => {
    const { id } = c.req.valid("param");

    const result = await getArtist(id, c.var.db());
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
      const result = await registerArtist(payload, c.var.db());
      if (result instanceof Error) return respondWithError(result, c);

      return c.json(result, 201);
    },
  )
  .patch(
    "/api/artists/:id",
    csrfProtection(),
    requireAuthMiddleware(),
    artistIdParamValidator,
    async (c) => {
      const { id } = c.req.valid("param");
      const result = await syncArtist(id, c.var.db());

      if (result instanceof Error) return respondWithError(result, c);

      return c.json(result);
    },
  );

export { artists };
