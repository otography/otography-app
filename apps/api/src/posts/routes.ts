import { zValidator } from "@hono/zod-validator";
import * as errore from "errore";
import { Hono } from "hono";
import { requireAuth, type SessionEnv } from "../auth/session.ts";
import { fetchSong } from "../lib/apple-music/client.ts";
import { db } from "../lib/db.ts";
import { PostNotFoundError } from "./errors.ts";
import { createPostInput } from "./schemas.ts";
import { createPost } from "./usecases/create-post.ts";
import { getPost } from "./usecases/get-post.ts";
import { setLike } from "./usecases/like-post.ts";

const INTERNAL_ERROR = "処理に失敗しました。時間をおいて、もう一度試してください";

export const postsRoutes = new Hono<SessionEnv>()
  // 曲を選んで投稿する。
  .post(
    "/",
    requireAuth,
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
            console.error(e);
            return {
              status: 500,
              error: "投稿できませんでした。時間をおいて、もう一度試してください",
            };
          },
        );
        return c.json({ error }, status);
      }
      return c.json(post, 201);
    },
  )
  // 投稿 1 件。
  .get("/:id", requireAuth, async (c) => {
    const post = await getPost({ db, postId: c.req.param("id"), viewerId: c.get("user").id });
    if (post instanceof PostNotFoundError) return c.json({ error: post.message }, 404);
    if (post instanceof Error) {
      console.error(post);
      return c.json({ error: INTERNAL_ERROR }, 500);
    }
    return c.json(post);
  })
  // いいねを付ける。付け済みでも 200 を返す。
  .put("/:id/like", requireAuth, async (c) => {
    const like = await setLike({
      db,
      userId: c.get("user").id,
      postId: c.req.param("id"),
      liked: true,
    });
    if (like instanceof PostNotFoundError) return c.json({ error: like.message }, 404);
    if (like instanceof Error) {
      console.error(like);
      return c.json({ error: INTERNAL_ERROR }, 500);
    }
    return c.json(like);
  })
  // いいねを外す。付けていなくても 200 を返す。
  .delete("/:id/like", requireAuth, async (c) => {
    const like = await setLike({
      db,
      userId: c.get("user").id,
      postId: c.req.param("id"),
      liked: false,
    });
    if (like instanceof PostNotFoundError) return c.json({ error: like.message }, 404);
    if (like instanceof Error) {
      console.error(like);
      return c.json({ error: INTERNAL_ERROR }, 500);
    }
    return c.json(like);
  });
