import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { DbError } from "@repo/errors";
import { csrfProtection, getAuthSession, requireAuthMiddleware } from "../../shared/middleware";
import type { Bindings } from "../../shared/types/bindings";
import { postInsertSchema, postUpdateSchema } from "./model";
import { getPost, getPosts, modifyPost, registerPost, removePost } from "./usecase";

const handlePostError = (error: DbError, c: Context<{ Bindings: Bindings }>) => {
  return c.json({ message: error.message }, error.statusCode);
};

const postBodyValidator = arktypeValidator("json", postInsertSchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: "Please provide a valid post payload." }, 400);
  }
});

const postIdParamSchema = type({
  id: "string.uuid",
});

const postIdParamValidator = arktypeValidator("param", postIdParamSchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: "Please provide a valid post id." }, 400);
  }
});

const postUpdateBodyValidator = arktypeValidator("json", postUpdateSchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: "Please provide a valid post payload." }, 400);
  }
});

const posts = new Hono<{ Bindings: Bindings }>()
  .get("/api/posts", async (c) => {
    const result = await getPosts();
    if (result instanceof Error) return handlePostError(result, c);

    return c.json(result);
  })
  .get("/api/posts/:id", postIdParamValidator, async (c) => {
    const { id } = c.req.valid("param");

    const result = await getPost(id);
    if (result instanceof Error) return handlePostError(result, c);

    return c.json(result);
  })
  .post("/api/posts", csrfProtection(), requireAuthMiddleware(), postBodyValidator, async (c) => {
    const session = getAuthSession(c);
    if (!session) {
      return c.json({ message: "You are not logged in." }, 401);
    }
    const payload = c.req.valid("json");

    const result = await registerPost(payload, session.sub);
    if (result instanceof Error) return handlePostError(result, c);

    return c.json(result, 201);
  })
  .patch(
    "/api/posts/:id",
    csrfProtection(),
    requireAuthMiddleware(),
    postIdParamValidator,
    postUpdateBodyValidator,
    async (c) => {
      const { id } = c.req.valid("param");
      const payload = c.req.valid("json");
      if (Object.keys(payload).length === 0) {
        return c.json({ message: "Please provide at least one field to update." }, 400);
      }

      const result = await modifyPost({ id, payload });
      if (result instanceof Error) return handlePostError(result, c);

      return c.json(result);
    },
  )
  .delete(
    "/api/posts/:id",
    csrfProtection(),
    requireAuthMiddleware(),
    postIdParamValidator,
    async (c) => {
      const { id } = c.req.valid("param");
      const result = await removePost(id);
      if (result instanceof Error) return handlePostError(result, c);

      return c.body(null, 204);
    },
  );

export { posts };
