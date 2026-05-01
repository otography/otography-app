import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { DbError } from "@repo/errors";
import { csrfProtection, requireAuthMiddleware, getAuthSession } from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import { addFavoriteArtistSchema } from "./model";
import {
  getFavoriteArtists,
  getPublicFavoriteArtists,
  registerFavoriteArtist,
  deleteFavoriteArtist,
} from "./usecase";

const handleError = (error: Error, c: { json: (body: unknown, status: number) => Response }) => {
  const statusCode = error instanceof DbError ? error.statusCode : 500;
  return c.json({ message: error.message }, statusCode);
};

const appleMusicIdParamSchema = type({
  appleMusicId: "string >= 1",
});

const userIdParamSchema = type({
  userId: "string.uuid",
});

const favoriteArtists = new Hono<{ Bindings: Bindings }>()
  // 自分のお気に入りアーティスト一覧取得
  .get("/api/me/favorites/artists", requireAuthMiddleware(), async (c) => {
    const session = getAuthSession(c);
    if (!session) {
      return c.json({ message: "ログインしていません。" }, 401);
    }

    const result = await getFavoriteArtists(session);
    if (result instanceof Error) return handleError(result, c);

    return c.json(result);
  })

  // 他人のお気に入りアーティスト一覧取得（読み取り専用）
  .get(
    "/api/users/:userId/favorites/artists",
    arktypeValidator("param", userIdParamSchema, (result, c) => {
      if (!result.success) {
        return c.json({ message: "無効なユーザーIDです。" }, 400);
      }
    }),
    async (c) => {
      const { userId } = c.req.valid("param");
      const result = await getPublicFavoriteArtists(userId);
      if (result instanceof Error) return handleError(result, c);

      return c.json(result);
    },
  )

  // お気に入りアーティスト登録
  .post(
    "/api/me/favorites/artists",
    csrfProtection(),
    requireAuthMiddleware(),
    arktypeValidator("json", addFavoriteArtistSchema, (result, c) => {
      if (!result.success) {
        return c.json({ message: "リクエストが不正です。" }, 400);
      }
    }),
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return c.json({ message: "ログインしていません。" }, 401);
      }

      const input = c.req.valid("json");
      const result = await registerFavoriteArtist(session, input);
      if (result instanceof Error) return handleError(result, c);

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
        return c.json({ message: "無効な Apple Music ID です。" }, 400);
      }
    }),
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return c.json({ message: "ログインしていません。" }, 401);
      }

      const { appleMusicId } = c.req.valid("param");
      const result = await deleteFavoriteArtist(session, appleMusicId);
      if (result instanceof Error) return handleError(result, c);

      return c.body(null, 204);
    },
  );

export { favoriteArtists };
