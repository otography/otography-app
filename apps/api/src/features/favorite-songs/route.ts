import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import {
  badRequestResponse,
  respondWithError,
  unauthorizedResponse,
} from "../../shared/errors/error-response";
import {
  csrfProtection,
  requireAuthMiddleware,
  getAuthSession,
  rateLimitByUser,
} from "../../shared/middleware";
import type { Env } from "../../shared/types/env";
import { addFavoriteSongSchema } from "./model";
import {
  appleMusicIdParamSchema,
  userIdParamSchema,
  parsePaginationQuery,
} from "../favorite-shared";
import {
  getFavoriteSongs,
  getPublicFavoriteSongs,
  registerFavoriteSong,
  deleteFavoriteSong,
} from "./usecase";

const favoriteSongs = new Hono<Env>()
  // 自分のお気に入り楽曲一覧取得
  .get("/api/me/favorites/songs", requireAuthMiddleware(), async (c) => {
    const session = getAuthSession(c);
    if (!session) {
      return unauthorizedResponse(c, "ログインしていません。");
    }

    const { limit, cursor } = parsePaginationQuery(c);
    const result = await getFavoriteSongs(session, c.var.db(), { limit, cursor });
    if (result instanceof Error) return respondWithError(result, c);

    return c.json(result);
  })

  // 他人のお気に入り楽曲一覧取得（読み取り専用）
  .get(
    "/api/users/:userId/favorites/songs",
    arktypeValidator("param", userIdParamSchema, (result, c) => {
      if (!result.success) {
        return badRequestResponse(c, "無効なユーザーIDです。");
      }
    }),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { limit, cursor } = parsePaginationQuery(c);
      const result = await getPublicFavoriteSongs(userId, c.var.db(), { limit, cursor });
      if (result instanceof Error) return respondWithError(result, c);

      return c.json(result);
    },
  )

  // お気に入り楽曲登録
  .post(
    "/api/me/favorites/songs",
    csrfProtection(),
    requireAuthMiddleware(),
    rateLimitByUser("CONTENT_RATE_LIMITER"),
    arktypeValidator("json", addFavoriteSongSchema, (result, c) => {
      if (!result.success) {
        return badRequestResponse(c, "リクエストが不正です。");
      }
    }),
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return unauthorizedResponse(c, "ログインしていません。");
      }

      const input = c.req.valid("json");
      const result = await registerFavoriteSong(session, input, c.var.db());
      if (result instanceof Error) return respondWithError(result, c);

      return c.json(result, 201);
    },
  )

  // お気に入り楽曲削除（appleMusicId 指定）
  .delete(
    "/api/me/favorites/songs/:appleMusicId",
    csrfProtection(),
    requireAuthMiddleware(),
    arktypeValidator("param", appleMusicIdParamSchema, (result, c) => {
      if (!result.success) {
        return badRequestResponse(c, "無効な Apple Music ID です。");
      }
    }),
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return unauthorizedResponse(c, "ログインしていません。");
      }

      const { appleMusicId } = c.req.valid("param");
      const result = await deleteFavoriteSong(session, appleMusicId, c.var.db());
      if (result instanceof Error) return respondWithError(result, c);

      return c.body(null, 204);
    },
  );

export { favoriteSongs };
