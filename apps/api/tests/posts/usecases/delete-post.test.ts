import { postEmbeddings, posts, users } from "db";
import { EMBEDDING_DIMENSIONS } from "db/constants";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import type { Database } from "../../../src/lib/db.ts";
import { PostNotFoundError } from "../../../src/posts/errors.ts";
import { deletePost } from "../../../src/posts/usecases/delete-post.ts";
import { getPost } from "../../../src/posts/usecases/get-post.ts";
import { createTestDb } from "../../helpers/db.ts";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "author", name: "投稿者", email: "a@example.com", publicId: "author000001" },
    { id: "other", name: "他人", email: "b@example.com", publicId: "other0000001" },
  ]);
  await db.insert(posts).values({ id: "post1", userId: "author", content: "好きな曲" });
  await db.insert(postEmbeddings).values({
    postId: "post1",
    embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5),
    norm: 8,
    model: "test",
  });
});

describe("deletePost", () => {
  test("本人が消すと、論理削除して埋め込みを消し、投稿は見つからなくなる", async () => {
    expect(await deletePost({ db, postId: "post1", userId: "author" })).toBeNull();

    const [post] = await db.select().from(posts).where(eq(posts.id, "post1"));
    expect(post?.deletedAt).toBeInstanceOf(Date);
    expect(await db.select().from(postEmbeddings)).toHaveLength(0);
    expect(await getPost({ db, postId: "post1", viewerId: "author" })).toBeInstanceOf(
      PostNotFoundError,
    );
  });

  test("他人の投稿は消せず、埋め込みも残る", async () => {
    expect(await deletePost({ db, postId: "post1", userId: "other" })).toBeInstanceOf(
      PostNotFoundError,
    );
    const [post] = await db.select().from(posts).where(eq(posts.id, "post1"));
    expect(post?.deletedAt).toBeNull();
    expect(await db.select().from(postEmbeddings)).toHaveLength(1);
  });

  test("削除済みの投稿と無い投稿は、見つからない扱いにする", async () => {
    await deletePost({ db, postId: "post1", userId: "author" });
    expect(await deletePost({ db, postId: "post1", userId: "author" })).toBeInstanceOf(
      PostNotFoundError,
    );
    expect(await deletePost({ db, postId: "nothing", userId: "author" })).toBeInstanceOf(
      PostNotFoundError,
    );
  });
});
