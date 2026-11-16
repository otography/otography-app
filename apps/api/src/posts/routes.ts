import { zValidator } from "@hono/zod-validator";
import * as errore from "errore";
import { Hono } from "hono";
import { requireAuth, type SessionEnv } from "../auth/session.ts";
import { fetchSong } from "../lib/apple-music/client.ts";
import { db } from "../lib/db.ts";
import { createPostInput } from "./schemas.ts";
import { createPost } from "./usecases/create-post.ts";

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
  );
