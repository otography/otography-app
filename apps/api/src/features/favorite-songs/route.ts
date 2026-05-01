import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { DbError } from "@repo/errors";
import { csrfProtection, requireAuthMiddleware, getAuthSession } from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import { addFavoriteSongSchema } from "./model";
import {
  getFavoriteSongs,
  getPublicFavoriteSongs,
  registerFavoriteSong,
  deleteFavoriteSong,
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

const favoriteSongs = new Hono<{ Bindings: Bindings }>()
  // 自分のお気に入り楽曲一覧取得
  .get("/api/me/favorites/songs", requireAuthMiddleware(), async (c) => {
    const session = getAuthSession(c);
    if (!session) {
      return c.json({ message: "ログインしていません。" }, 401);
    }

    const result = await getFavoriteSongs(session);
    if (result instanceof Error) return handleError(result, c);

    return c.json(result);
  })

  // 他人のお気に入り楽曲一覧取得（読み取り専用）
  .get(
    "/api/users/:userId/favorites/songs",
    arktypeValidator("param", userIdParamSchema, (result, c) => {
      if (!result.success) {
        return c.json({ message: "無効なユーザーIDです。" }, 400);
      }
    }),
    async (c) => {
      const { userId } = c.req.valid("param");
      const result = await getPublicFavoriteSongs(userId);
      if (result instanceof Error) return handleError(result, c);

      return c.json(result);
    },
  )

  // お気に入り楽曲登録
  .post(
    "/api/me/favorites/songs",
    csrfProtection(),
    requireAuthMiddleware(),
    arktypeValidator("json", addFavoriteSongSchema, (result, c) => {
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
      const result = await registerFavoriteSong(session, input);
      if (result instanceof Error) return handleError(result, c);

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
        return c.json({ message: "無効な Apple Music ID です。" }, 400);
      }
    }),
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return c.json({ message: "ログインしていません。" }, 401);
      }

      const { appleMusicId } = c.req.valid("param");
      const result = await deleteFavoriteSong(session, appleMusicId);
      if (result instanceof Error) return handleError(result, c);

      return c.body(null, 204);
    },
  );

export { favoriteSongs };
