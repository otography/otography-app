import { accounts, favoriteSongs, likes, postEmbeddings, posts, sessions, songs, users } from "db";
import { EMBEDDING_DIMENSIONS } from "db/constants";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import type { Database } from "../../../src/lib/db.ts";
import { PostNotFoundError } from "../../../src/posts/errors.ts";
import { getPost } from "../../../src/posts/usecases/get-post.ts";
import { UserNotFoundError } from "../../../src/users/errors.ts";
import { deleteAccount } from "../../../src/users/usecases/delete-account.ts";
import { getProfile } from "../../../src/users/usecases/get-profile.ts";
import { createTestDb } from "../../helpers/db.ts";

let db: Database;
const now = new Date();

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    {
      id: "leaver",
      name: "退会者",
      email: "a@example.com",
      publicId: "leaver000001",
      bio: "自己紹介",
    },
    { id: "other", name: "他人", email: "b@example.com", publicId: "other0000001" },
  ]);
  await db.insert(songs).values({ isrc: "JPAA00000001", appleSongId: "1", fetchedAt: now });
  await db
    .insert(favoriteSongs)
    .values({ userId: "leaver", songIsrc: "JPAA00000001", position: 0 });
  await db.insert(accounts).values({
    id: "acc1",
    accountId: "google-1",
    providerId: "google",
    userId: "leaver",
    updatedAt: now,
  });
  await db.insert(sessions).values({
    id: "s1",
    token: "t1",
    userId: "leaver",
    expiresAt: new Date("2030-01-01"),
    updatedAt: now,
  });
  await db.insert(posts).values([
    { id: "mine", userId: "leaver", content: "退会者の投稿" },
    { id: "theirs", userId: "other", content: "他人の投稿", likeCount: 2 },
  ]);
  await db.insert(likes).values([
    { userId: "leaver", postId: "theirs" },
    { userId: "other", postId: "theirs" },
  ]);
  await db.insert(postEmbeddings).values({
    postId: "mine",
    embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5),
    model: "test",
  });
});

describe("deleteAccount", () => {
  test("個人の情報とログイン連携を消し、投稿とプロフィールを見えなくする", async () => {
    expect(await deleteAccount({ db, userId: "leaver" })).toBeNull();

    const [leaver] = await db.select().from(users).where(eq(users.id, "leaver"));
    expect(leaver).toMatchObject({
      name: "退会したユーザー",
      bio: null,
      email: "deleted-leaver@invalid",
    });
    expect(leaver?.deletedAt).toBeInstanceOf(Date);
    expect(await db.select().from(favoriteSongs)).toHaveLength(0);
    expect(await db.select().from(accounts)).toHaveLength(0);
    expect(await db.select().from(sessions)).toHaveLength(0);
    expect(await db.select().from(postEmbeddings)).toHaveLength(0);

    expect(await getProfile({ db, publicId: "leaver000001" })).toBeInstanceOf(UserNotFoundError);
    expect(await getPost({ db, postId: "mine", viewerId: "other" })).toBeInstanceOf(
      PostNotFoundError,
    );
  });

  test("退会者のいいねを消し、件数を数え直す。updated_at は変えない", async () => {
    const [before] = await db.select().from(posts).where(eq(posts.id, "theirs"));
    await deleteAccount({ db, userId: "leaver" });
    const [after] = await db.select().from(posts).where(eq(posts.id, "theirs"));
    expect(after?.likeCount).toBe(1);
    expect(after?.updatedAt).toEqual(before?.updatedAt);
    expect(await db.select().from(likes)).toEqual([
      expect.objectContaining({ userId: "other", postId: "theirs" }),
    ]);
  });
});
