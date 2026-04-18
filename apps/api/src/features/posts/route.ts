import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { AuthError } from "@repo/errors/server";
import { csrfProtection, requireAuthMiddleware, getAuthSession } from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import { createPost, deletePost, getPost, updatePost } from "./usecase";

// 投稿作成のバリデーションスキーマ
// content: 1-2000文字、空白のみは拒否（trim後に1文字以上）
// songId: 有効なUUID形式
const createPostSchema = type({
  content: type.pipe(type("string.trim"), type("string >= 1"), type("string <= 2000")),
  songId: "string.uuid",
});

// 投稿更新のバリデーションスキーマ
const updatePostSchema = type({
  content: type.pipe(type("string.trim"), type("string >= 1"), type("string <= 2000")),
});

const handlePostError = (error: AuthError, c: Context<{ Bindings: Bindings }>) => {
  return c.json({ message: error.message }, error.statusCode);
};

const posts = new Hono<{ Bindings: Bindings }>()
  // 投稿を作成
  .post(
    "/api/posts",
    csrfProtection(),
    requireAuthMiddleware(),
    arktypeValidator("json", createPostSchema, (result, c) => {
      if (!result.success) {
        return c.json({ message: "Invalid post data." }, 400);
      }
    }),
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return c.json({ message: "You are not logged in." }, 401);
      }
      const values = c.req.valid("json");
      const result = await createPost(session, values);
      if (result instanceof Error) return handlePostError(result, c);
      return c.json({ message: "Post created.", post: result.post }, 201);
    },
  )

  // 単一投稿を取得
  .get("/api/posts/:id", async (c) => {
    const { id } = c.req.param();
    const result = await getPost(id);
    if (result instanceof Error) return handlePostError(result, c);
    return c.json(result, 200);
  })

  // 投稿を更新
  .patch(
    "/api/posts/:id",
    csrfProtection(),
    requireAuthMiddleware(),
    arktypeValidator("json", updatePostSchema, (result, c) => {
      if (!result.success) {
        return c.json({ message: "Invalid post data." }, 400);
      }
    }),
    async (c) => {
      const session = getAuthSession(c);
      if (!session) {
        return c.json({ message: "You are not logged in." }, 401);
      }
      const { id } = c.req.param();
      const { content } = c.req.valid("json");
      const result = await updatePost(session, id, content);
      if (result instanceof Error) return handlePostError(result, c);
      return c.json({ message: "Post updated.", post: result.post }, 200);
    },
  )

  // 投稿を論理削除
  .delete("/api/posts/:id", csrfProtection(), requireAuthMiddleware(), async (c) => {
    const session = getAuthSession(c);
    if (!session) {
      return c.json({ message: "You are not logged in." }, 401);
    }
    const { id } = c.req.param();
    const result = await deletePost(session, id);
    if (result instanceof Error) return handlePostError(result, c);
    return c.json({ message: "Post deleted." }, 200);
  });

export { posts };
