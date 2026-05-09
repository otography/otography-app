import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { problemResponse, respondWithError } from "../../shared/errors/error-response";
import {
  csrfProtection,
  requireAuthMiddleware,
  getAuthSession,
  rateLimitByUser,
} from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import { addFavoriteArtistSchema } from "./model";
import {
  appleMusicIdParamSchema,
  userIdParamSchema,
  parsePaginationQuery,
} from "../favorite-shared";
import {
  getFavoriteArtists,
  getPublicFavoriteArtists,
  registerFavoriteArtist,
  deleteFavoriteArtist,
} from "./usecase";

const favoriteArtists = new Hono<{ Bindings: Bindings }>()
  // 自分のお気に入りアーティスト一覧取得
  .get("/api/me/favorites/artists", requireAuthMiddleware(), async (c) => {
    const session = getAuthSession(c);
    if (!session) {
      return problemResponse(c, 401, "unauthorized", "Unauthorized", "ログインしていません。");
    }

    const { limit, cursor } = parsePaginationQuery(c);
    const result = await getFavoriteArtists(session, { limit, cursor });
    if (result instanceof Error) return respondWithError(result, c);

    return c.json(result);
  })

  // 他人のお気に入りアーティスト一覧取得（読み取り専用）
  .get(
    "/api/users/:userId/favorites/artists",
    arktypeValidator("param", userIdParamSchema, (result, c) => {
      if (!result.success) {
        return problemResponse(c, 400, "bad-request", "Bad Request", "無効なユーザーIDです。");
      }
    }),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { limit, cursor } = parsePaginationQuery(c);
      const result = await getPublicFavoriteArtists(userId, { limit, cursor });
      if (result instanceof Error) return respondWithError(result, c);

      return c.json(result);
    },
  )

  // お気に入りアーティスト登録
  .post(
    "/api/me/favorites/artists",
    csrfProtection(),
    requireAuthMiddleware(),
    rateLimitByUser("CONTENT_RATE_LIMITER"),
    arktypeValidator("json", addFavoriteArtistSchema, (result, c) => {
      if (!result.success) {
        return problemResponse(c, 400, "bad-request", "Bad Request", "リクエストが不正です。");
      }
    }),
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return problemResponse(c, 401, "unauthorized", "Unauthorized", "ログインしていません。");
      }

      const input = c.req.valid("json");
      const result = await registerFavoriteArtist(session, input);
      if (result instanceof Error) return respondWithError(result, c);

      return c.json(result, 201);
    },
  )

  // お気に入りアーティスト削除（appleMusicId 指定）
  .delete(
    "/api/me/favorites/artists/:appleMusicId",
    csrfProtection(),
    requireAuthMiddleware(),
    arktypeValidator("param", appleMusicIdParamSchema, (result, c) => {
      if (!result.success) {
        return problemResponse(
          c,
          400,
          "bad-request",
          "Bad Request",
          "無効な Apple Music ID です。",
        );
      }
    }),
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return problemResponse(c, 401, "unauthorized", "Unauthorized", "ログインしていません。");
      }

      const { appleMusicId } = c.req.valid("param");
      const result = await deleteFavoriteArtist(session, appleMusicId);
      if (result instanceof Error) return respondWithError(result, c);

      return c.body(null, 204);
    },
  );

export { favoriteArtists };
