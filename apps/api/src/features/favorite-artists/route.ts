import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { formatErrorResponse } from "../../shared/errors/error-response";
import {
  csrfProtection,
  requireAuthMiddleware,
  getAuthSession,
  rateLimitByUser,
} from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import type { Cursor } from "../../shared/pagination";
import { addFavoriteArtistSchema } from "./model";
import {
  getFavoriteArtists,
  getPublicFavoriteArtists,
  registerFavoriteArtist,
  deleteFavoriteArtist,
} from "./usecase";

/**
 * RFC 7807 Problem Details 形式のエラーレスポンスを返すヘルパー
 */
const problemResponse = (
  c: Context,
  statusCode: ContentfulStatusCode,
  typeSlug: string,
  title: string,
  detail: string,
) => {
  return c.body(
    JSON.stringify({
      type: `https://api.otography.com/errors/${typeSlug}`,
      title,
      status: statusCode,
      detail,
    }),
    statusCode,
    { "Content-Type": "application/problem+json" },
  );
};

const appleMusicIdParamSchema = type({
  appleMusicId: "string >= 1",
});

const userIdParamSchema = type({
  userId: "string.uuid",
});

const parsePaginationQuery = (c: { req: { query: (key: string) => string | undefined } }) => {
  const limitParam = c.req.query("limit");
  const cursorCreatedAt = c.req.query("cursor[createdAt]");
  const cursorId = c.req.query("cursor[id]");

  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  let cursor: Cursor | undefined;
  if (cursorCreatedAt && cursorId) {
    cursor = { createdAt: cursorCreatedAt, id: cursorId };
  }
  return { limit, cursor };
};

const favoriteArtists = new Hono<{ Bindings: Bindings }>()
  // 自分のお気に入りアーティスト一覧取得
  .get("/api/me/favorites/artists", requireAuthMiddleware(), async (c) => {
    const session = getAuthSession(c);
    if (!session) {
      return problemResponse(c, 401, "unauthorized", "Unauthorized", "ログインしていません。");
    }

    const { limit, cursor } = parsePaginationQuery(c);
    const result = await getFavoriteArtists(session, { limit, cursor });
    if (result instanceof Error) {
      const { body, statusCode } = formatErrorResponse(result);
      return c.body(JSON.stringify(body), statusCode, {
        "Content-Type": "application/problem+json",
      });
    }

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
      if (result instanceof Error) {
        const { body, statusCode } = formatErrorResponse(result);
        return c.body(JSON.stringify(body), statusCode, {
          "Content-Type": "application/problem+json",
        });
      }

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
      if (result instanceof Error) {
        const { body, statusCode } = formatErrorResponse(result);
        return c.body(JSON.stringify(body), statusCode, {
          "Content-Type": "application/problem+json",
        });
      }

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
      if (result instanceof Error) {
        const { body, statusCode } = formatErrorResponse(result);
        return c.body(JSON.stringify(body), statusCode, {
          "Content-Type": "application/problem+json",
        });
      }

      return c.body(null, 204);
    },
  );

export { favoriteArtists };
