import { likes, posts, songs, users } from "db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import type { Database } from "../../../src/lib/db.ts";
import { PostNotFoundError } from "../../../src/posts/errors.ts";
import { getPost } from "../../../src/posts/usecases/get-post.ts";
import { setLike } from "../../../src/posts/usecases/like-post.ts";
import { listPostsByAuthor } from "../../../src/posts/usecases/list-posts-by-author.ts";
import { createTestDb } from "../../helpers/db.ts";

let db: Database;
const createdAt = new Date("2026-11-01T00:00:00Z");

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "author", name: "投稿者", email: "a@example.com", publicId: "author000001" },
    { id: "viewer", name: "閲覧者", email: "b@example.com", publicId: "viewer000001" },
  ]);
  await db.insert(songs).values({
    isrc: "JPAA00000001",
    appleSongId: "1",
    title: "曲",
    fetchedAt: createdAt,
  });
  await db.insert(posts).values({
    id: "post1",
    userId: "author",
    songIsrc: "JPAA00000001",
    content: "好きな曲",
    createdAt,
    updatedAt: createdAt,
  });
});

const likeCountOf = async (postId: string) =>
  (await db.select().from(posts).where(eq(posts.id, postId)))[0]?.likeCount;

describe("setLike", () => {
  test("いいねを付けると件数が増え、2 回付けても 1 件のまま", async () => {
    expect(await setLike({ db, userId: "viewer", postId: "post1", liked: true })).toEqual({
      likeCount: 1,
      likedByMe: true,
    });
    expect(await setLike({ db, userId: "viewer", postId: "post1", liked: true })).toEqual({
      likeCount: 1,
      likedByMe: true,
    });
    expect(await setLike({ db, userId: "author", postId: "post1", liked: true })).toEqual({
      likeCount: 2,
      likedByMe: true,
    });
    expect(await db.select().from(likes)).toHaveLength(2);
  });

  test("いいねを外すと件数が減り、付けていなくても成功する", async () => {
    await setLike({ db, userId: "viewer", postId: "post1", liked: true });
    expect(await setLike({ db, userId: "viewer", postId: "post1", liked: false })).toEqual({
      likeCount: 0,
      likedByMe: false,
    });
    expect(await setLike({ db, userId: "viewer", postId: "post1", liked: false })).toEqual({
      likeCount: 0,
      likedByMe: false,
    });
  });

  test("いいねでは、投稿の updated_at を変えない", async () => {
    await setLike({ db, userId: "viewer", postId: "post1", liked: true });
    const [post] = await db.select().from(posts).where(eq(posts.id, "post1"));
    expect(post?.updatedAt).toEqual(createdAt);
  });

  test("削除・非表示の投稿や、無い投稿には、いいねを保存しない", async () => {
    await db.update(posts).set({ hiddenAt: new Date() }).where(eq(posts.id, "post1"));
    expect(await setLike({ db, userId: "viewer", postId: "post1", liked: true })).toBeInstanceOf(
      PostNotFoundError,
    );
    expect(await setLike({ db, userId: "viewer", postId: "nothing", liked: true })).toBeInstanceOf(
      PostNotFoundError,
    );
    expect(await db.select().from(likes)).toHaveLength(0);
    expect(await likeCountOf("post1")).toBe(0);
  });
});

describe("getPost", () => {
  test("投稿者、曲、件数、閲覧者がいいね済みかを返す", async () => {
    await setLike({ db, userId: "viewer", postId: "post1", liked: true });
    const post = await getPost({ db, postId: "post1", viewerId: "viewer" });
    if (post instanceof Error) throw post;
    expect(post).toMatchObject({
      id: "post1",
      content: "好きな曲",
      likeCount: 1,
      likedByMe: true,
      author: { publicId: "author000001", name: "投稿者" },
      song: { isrc: "JPAA00000001", title: "曲" },
    });
    expect(post).not.toHaveProperty("likes");
    expect(await getPost({ db, postId: "post1", viewerId: "author" })).toMatchObject({
      likedByMe: false,
    });
  });

  test("削除した投稿と、利用停止中のユーザーの投稿は見つからない", async () => {
    await db.update(users).set({ suspendedAt: new Date() }).where(eq(users.id, "author"));
    expect(await getPost({ db, postId: "post1", viewerId: "viewer" })).toBeInstanceOf(
      PostNotFoundError,
    );
    await db.update(users).set({ suspendedAt: null }).where(eq(users.id, "author"));
    await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, "post1"));
    expect(await getPost({ db, postId: "post1", viewerId: "viewer" })).toBeInstanceOf(
      PostNotFoundError,
    );
  });
});

describe("listPostsByAuthor", () => {
  test("新しい順に 20 件ずつ返し、作成日時が同じ投稿も漏れなく続きで返す", async () => {
    // post1 と同じ作成日時の投稿を含めて、合計 25 件にする。
    await db.insert(posts).values(
      Array.from({ length: 24 }, (_, i) => ({
        id: `p${String(i).padStart(2, "0")}`,
        userId: "author",
        content: `投稿${i}`,
        createdAt: new Date(createdAt.getTime() + (i < 4 ? 0 : i * 1000)),
      })),
    );
    await db.insert(posts).values({
      id: "deleted",
      userId: "author",
      content: "削除済み",
      deletedAt: new Date(),
    });

    const first = await listPostsByAuthor({
      db,
      publicId: "author000001",
      viewerId: "viewer",
      before: null,
    });
    if (first instanceof Error) throw first;
    expect(first.posts).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();

    const [ms, id] = (first.nextCursor ?? "").split("_");
    const second = await listPostsByAuthor({
      db,
      publicId: "author000001",
      viewerId: "viewer",
      before: { createdAt: new Date(Number(ms)), id: id ?? "" },
    });
    if (second instanceof Error) throw second;
    expect(second.posts).toHaveLength(5);
    expect(second.nextCursor).toBeNull();

    const ids = [...first.posts, ...second.posts].map((post) => post.id);
    expect(new Set(ids).size).toBe(25);
    expect(ids).not.toContain("deleted");
    expect(ids.slice(-5)).toEqual(["post1", "p03", "p02", "p01", "p00"]);
  });
});
