import { sql as drizzleSql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { listPostsWithLikes, findPostByIdWithLikes } from "../../../features/posts/repository";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db/client";
import { createPost, createSong, createUser, likePost } from "../../helpers/db/fixtures";
import { withAnonymousRole } from "../../../shared/db/rls";

const sql = createTestSql();
const db = createTestDb(sql);

afterAll(async () => {
  await sql.end();
});

describe("listPostsWithLikes", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("ログイン済みユーザーがいいねした投稿は isLiked=true になる", async () => {
    // Given
    const author = await createUser(db, { username: "author", name: "Author" });
    const liker = await createUser(db);
    const song = await createSong(db);
    const post = await createPost(db, author.id, song.id, { content: "hello" });
    await likePost(db, liker.id, post.id);

    // When
    const rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, liker.id));
    if (rows instanceof Error) throw rows;

    // Then
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      content: "hello",
      likeCount: 1,
      isLiked: true,
      author: { username: "author", name: "Author" },
    });
  });

  it("未ログインユーザーには isLiked=false になる", async () => {
    // Given
    const author = await createUser(db);
    const liker = await createUser(db);
    const song = await createSong(db);
    const post = await createPost(db, author.id, song.id);
    await likePost(db, liker.id, post.id);

    // When
    const rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, null));
    if (rows instanceof Error) throw rows;

    // Then
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ likeCount: 1, isLiked: false });
  });

  it("論理削除された投稿は一覧に含まれない", async () => {
    // Given
    const author = await createUser(db);
    const song = await createSong(db);
    await createPost(db, author.id, song.id, { deletedAt: new Date().toISOString() });

    // When
    const rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, null));
    if (rows instanceof Error) throw rows;

    // Then
    expect(rows).toHaveLength(0);
  });
});

describe("findPostByIdWithLikes", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("いいね済みユーザーには isLiked=true を返す", async () => {
    // Given
    const author = await createUser(db, { username: "author", name: "Author" });
    const liker = await createUser(db);
    const song = await createSong(db);
    const post = await createPost(db, author.id, song.id, { content: "detail" });
    await likePost(db, liker.id, post.id);

    // When
    const result = await withAnonymousRole(db, (tx) =>
      findPostByIdWithLikes(tx, post.id, liker.id),
    );

    // Then
    expect(result).toMatchObject({
      content: "detail",
      likeCount: 1,
      isLiked: true,
      author: { username: "author", name: "Author" },
    });
  });

  it("未ログインユーザーには isLiked=false を返す", async () => {
    // Given
    const author = await createUser(db);
    const song = await createSong(db);
    const post = await createPost(db, author.id, song.id);

    // When
    const result = await withAnonymousRole(db, (tx) => findPostByIdWithLikes(tx, post.id, null));

    // Then
    expect(result).toMatchObject({ likeCount: 0, isLiked: false });
  });

  it("論理削除された投稿は null を返す", async () => {
    // Given
    const author = await createUser(db);
    const song = await createSong(db);
    const post = await createPost(db, author.id, song.id, { deletedAt: new Date().toISOString() });

    // When
    const result = await withAnonymousRole(db, (tx) => findPostByIdWithLikes(tx, post.id, null));

    // Then
    expect(result).toBeNull();
  });
});

describe("投稿更新RLS", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("投稿所有者は自分の投稿を更新できる", async () => {
    // Given
    const owner = await createUser(db);
    const song = await createSong(db);
    const post = await createPost(db, owner.id, song.id, { content: "original" });

    // When
    await db.transaction(async (tx) => {
      await tx.execute(
        drizzleSql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: owner.id })}, true)`,
      );
      await tx.execute(drizzleSql`set local role authenticated`);

      const result = await tx.execute(drizzleSql`
        UPDATE posts SET content = 'edited' WHERE id = ${post.id} RETURNING content
      `);

      // Then
      expect(result).toEqual([{ content: "edited" }]);
    });
  });

  it("他のユーザーは投稿を更新できない", async () => {
    // Given
    const owner = await createUser(db);
    const other = await createUser(db);
    const song = await createSong(db);
    const post = await createPost(db, owner.id, song.id, { content: "original" });

    // When
    await db.transaction(async (tx) => {
      await tx.execute(
        drizzleSql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: other.id })}, true)`,
      );
      await tx.execute(drizzleSql`set local role authenticated`);

      const result = await tx.execute(drizzleSql`
        UPDATE posts SET content = 'hacked' WHERE id = ${post.id} RETURNING content
      `);

      // Then
      expect(result).toHaveLength(0);
    });
  });
});
