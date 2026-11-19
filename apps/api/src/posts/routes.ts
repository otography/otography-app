import { zValidator } from "@hono/zod-validator";
import * as errore from "errore";
import { Hono } from "hono";
import { requireAuth, type SessionEnv } from "../auth/session.ts";
import { fetchSong } from "../lib/apple-music/client.ts";
import { db } from "../lib/db.ts";
import { rateLimit } from "../lib/rate-limit/middleware.ts";
import { PostNotFoundError } from "./errors.ts";
import { createPostInput } from "./schemas.ts";
import { createPost } from "./usecases/create-post.ts";
import { embedNewPost } from "../embeddings/worker.ts";
import { deletePost } from "./usecases/delete-post.ts";
import { getPost } from "./usecases/get-post.ts";
import { setLike } from "./usecases/like-post.ts";
import { logError } from "../lib/log.ts";

const INTERNAL_ERROR = "処理に失敗しました。時間をおいて、もう一度試してください";

export const postsRoutes = new Hono<SessionEnv>()
  // 曲を選んで投稿する。
  .post(
    "/",
    requireAuth,
    rateLimit("WRITE_RATE_LIMIT"),
    zValidator("json", createPostInput, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: "入力が正しくありません。本文と曲を確認してください",
            issues: result.error.issues,
          },
          400,
        );
      }
    }),
    async (c) => {
      const post = await createPost({
        db,
        fetchSong,
        user: c.get("user"),
        ipAddress: c.req.header("cf-connecting-ip") ?? null,
        input: c.req.valid("json"),
      });
      if (post instanceof Error) {
        // 利用者が対処できるエラーだけ、そのメッセージを返す。それ以外はログに残して 500 にする。
        const { status, error } = errore.matchErrorPartial<
          typeof post,
          { status: 422 | 500 | 503; error: string }
        >(
          post,
          {
            AppleSongNotFoundError: (e) => ({ status: 422, error: e.message }),
            SongWithoutIsrcError: (e) => ({ status: 422, error: e.message }),
            AppleMusicRateLimitError: (e) => ({ status: 503, error: e.message }),
          },
          (e) => {
            logError(e);
            return {
              status: 500,
              error: "投稿できませんでした。時間をおいて、もう一度試してください",
            };
          },
        );
        return c.json({ error }, status);
      }
      // 埋め込みは応答を返した後に作る。失敗しても投稿は成功のままで、埋め込みのバッチが後で補う。
      c.executionCtx.waitUntil(embedNewPost(post));
      return c.json(post, 201);
    },
  )
  // 投稿 1 件。
  .get("/:id", requireAuth, rateLimit("READ_RATE_LIMIT"), async (c) => {
    const post = await getPost({ db, postId: c.req.param("id"), viewerId: c.get("user").id });
    if (post instanceof PostNotFoundError) return c.json({ error: post.message }, 404);
    if (post instanceof Error) {
      logError(post);
      return c.json({ error: INTERNAL_ERROR }, 500);
    }
    return c.json(post);
  })
  // 自分の投稿を削除する。
  .delete("/:id", requireAuth, rateLimit("WRITE_RATE_LIMIT"), async (c) => {
    const deleted = await deletePost({ db, postId: c.req.param("id"), userId: c.get("user").id });
    if (deleted instanceof PostNotFoundError) return c.json({ error: deleted.message }, 404);
    if (deleted instanceof Error) {
      logError(deleted);
      return c.json({ error: INTERNAL_ERROR }, 500);
    }
    return c.body(null, 204);
  })
  // いいねを付ける。付け済みでも 200 を返す。
  .put("/:id/like", requireAuth, rateLimit("LIKE_RATE_LIMIT"), async (c) => {
    const like = await setLike({
      db,
      userId: c.get("user").id,
      postId: c.req.param("id"),
      liked: true,
    });
    if (like instanceof PostNotFoundError) return c.json({ error: like.message }, 404);
    if (like instanceof Error) {
      logError(like);
      return c.json({ error: INTERNAL_ERROR }, 500);
    }
    return c.json(like);
  })
  // いいねを外す。付けていなくても 200 を返す。
  .delete("/:id/like", requireAuth, rateLimit("LIKE_RATE_LIMIT"), async (c) => {
    const like = await setLike({
      db,
      userId: c.get("user").id,
      postId: c.req.param("id"),
      liked: false,
    });
    if (like instanceof PostNotFoundError) return c.json({ error: like.message }, 404);
    if (like instanceof Error) {
      logError(like);
      return c.json({ error: INTERNAL_ERROR }, 500);
    }
    return c.json(like);
  });
