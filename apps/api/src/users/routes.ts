import { zValidator } from "@hono/zod-validator";
import * as errore from "errore";
import { Hono } from "hono";
import { requireAuth, type SessionEnv } from "../auth/session.ts";
import { fetchArtist, fetchSong } from "../lib/apple-music/client.ts";
import { db } from "../lib/db.ts";
import { rateLimit } from "../lib/rate-limit/middleware.ts";
import { listPostsQuery } from "../posts/schemas.ts";
import { listPostsByAuthor } from "../posts/usecases/list-posts-by-author.ts";
import { UserNotFoundError } from "./errors.ts";
import {
  replaceFavoriteArtistsInput,
  replaceFavoriteSongsInput,
  updateProfileInput,
} from "./schemas.ts";
import { deleteAccount } from "./usecases/delete-account.ts";
import { getMe } from "./usecases/get-me.ts";
import { getProfile } from "./usecases/get-profile.ts";
import { replaceFavoriteArtistsOfUser } from "./usecases/replace-favorite-artists.ts";
import { replaceFavoriteSongsOfUser } from "./usecases/replace-favorite-songs.ts";
import { updateProfile } from "./usecases/update-profile.ts";
import { logError } from "../lib/log.ts";

const INTERNAL_ERROR = "処理に失敗しました。時間をおいて、もう一度試してください";

const favoriteSongsValidator = zValidator("json", replaceFavoriteSongsInput, (result, c) => {
  if (!result.success) {
    return c.json({ error: "入力が正しくありません", issues: result.error.issues }, 400);
  }
});

export const usersRoutes = new Hono<SessionEnv>()
  // SPA は、200 ならログイン中、401 なら未ログインと判断する。
  .get("/me", requireAuth, async (c) => {
    const me = await getMe({ db, userId: c.get("user").id });
    if (me instanceof Error) {
      logError(me);
      return c.json({ error: INTERNAL_ERROR }, 500);
    }
    return c.json(me);
  })
  // 表示名と自己紹介を変える。
  .patch(
    "/me",
    requireAuth,
    rateLimit("WRITE_RATE_LIMIT"),
    zValidator("json", updateProfileInput, (result, c) => {
      if (!result.success) {
        return c.json({ error: "入力が正しくありません", issues: result.error.issues }, 400);
      }
    }),
    async (c) => {
      const me = await updateProfile({ db, userId: c.get("user").id, input: c.req.valid("json") });
      if (me instanceof Error) {
        logError(me);
        return c.json({ error: INTERNAL_ERROR }, 500);
      }
      return c.json(me);
    },
  )
  // 退会する。セッションも消すので、この後はログアウトした状態になる。
  .delete("/me", requireAuth, rateLimit("WRITE_RATE_LIMIT"), async (c) => {
    const deleted = await deleteAccount({ db, userId: c.get("user").id });
    if (deleted instanceof Error) {
      logError(deleted);
      return c.json({ error: INTERNAL_ERROR }, 500);
    }
    return c.body(null, 204);
  })
  // お気に入りの曲を一覧ごと置き換える。
  .put(
    "/me/favorite-songs",
    requireAuth,
    rateLimit("WRITE_RATE_LIMIT"),
    favoriteSongsValidator,
    async (c) => {
      const profile = await replaceFavoriteSongsOfUser({
        db,
        fetchSong,
        userId: c.get("user").id,
        input: c.req.valid("json"),
      });
      if (profile instanceof Error) {
        const { status, error } = errore.matchErrorPartial<
          typeof profile,
          { status: 400 | 422 | 500 | 503; error: string }
        >(
          profile,
          {
            DuplicateFavoriteSongError: (e) => ({ status: 400, error: e.message }),
            AppleSongNotFoundError: (e) => ({ status: 422, error: e.message }),
            SongWithoutIsrcError: (e) => ({ status: 422, error: e.message }),
            AppleMusicRateLimitError: (e) => ({ status: 503, error: e.message }),
          },
          (e) => {
            logError(e);
            return { status: 500, error: INTERNAL_ERROR };
          },
        );
        return c.json({ error }, status);
      }
      return c.json(profile);
    },
  )
  // お気に入りのアーティストを一覧ごと置き換える。
  .put(
    "/me/favorite-artists",
    requireAuth,
    rateLimit("WRITE_RATE_LIMIT"),
    zValidator("json", replaceFavoriteArtistsInput, (result, c) => {
      if (!result.success) {
        return c.json({ error: "入力が正しくありません", issues: result.error.issues }, 400);
      }
    }),
    async (c) => {
      const profile = await replaceFavoriteArtistsOfUser({
        db,
        fetchArtist,
        userId: c.get("user").id,
        input: c.req.valid("json"),
      });
      if (profile instanceof Error) {
        const { status, error } = errore.matchErrorPartial<
          typeof profile,
          { status: 400 | 422 | 500 | 503; error: string }
        >(
          profile,
          {
            DuplicateFavoriteArtistError: (e) => ({ status: 400, error: e.message }),
            AppleArtistNotFoundError: (e) => ({ status: 422, error: e.message }),
            AppleMusicRateLimitError: (e) => ({ status: 503, error: e.message }),
          },
          (e) => {
            logError(e);
            return { status: 500, error: INTERNAL_ERROR };
          },
        );
        return c.json({ error }, status);
      }
      return c.json(profile);
    },
  )
  // 他のユーザーのプロフィール。
  .get("/users/:publicId", requireAuth, rateLimit("READ_RATE_LIMIT"), async (c) => {
    const profile = await getProfile({ db, publicId: c.req.param("publicId") });
    if (profile instanceof Error) {
      if (profile instanceof UserNotFoundError) return c.json({ error: profile.message }, 404);
      logError(profile);
      return c.json({ error: INTERNAL_ERROR }, 500);
    }
    return c.json(profile);
  })
  // ユーザーの投稿を新しい順に返す。続きは nextCursor を cursor に渡して読む。
  .get(
    "/users/:publicId/posts",
    requireAuth,
    rateLimit("READ_RATE_LIMIT"),
    zValidator("query", listPostsQuery, (result, c) => {
      if (!result.success) {
        return c.json({ error: "cursor が正しくありません", issues: result.error.issues }, 400);
      }
    }),
    async (c) => {
      const page = await listPostsByAuthor({
        db,
        publicId: c.req.param("publicId"),
        viewerId: c.get("user").id,
        before: c.req.valid("query").cursor ?? null,
      });
      if (page instanceof Error) {
        logError(page);
        return c.json({ error: INTERNAL_ERROR }, 500);
      }
      return c.json(page);
    },
  );
