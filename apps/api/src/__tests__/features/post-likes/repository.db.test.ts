import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { countPostLikes } from "../../../features/post-likes/repository";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db/client";
import { createPost, createSong, createUser, likePost } from "../../helpers/db/fixtures";

const sql = createTestSql();
const db = createTestDb(sql);

describe("countPostLikes", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  afterAll(async () => {
    await sql.end();
  });

  it("いいねが0件なら0を返す", async () => {
    // Given
    const author = await createUser(db);
    const song = await createSong(db);
    const post = await createPost(db, author.id, song.id);

    // When
    const result = await countPostLikes(db, post.id);

    // Then
    expect(result).toBe(0);
  });

  it("いいね数を正しく返す", async () => {
    // Given
    const author = await createUser(db);
    const liker1 = await createUser(db);
    const liker2 = await createUser(db);
    const song = await createSong(db);
    const post = await createPost(db, author.id, song.id);

    await likePost(db, liker1.id, post.id);
    await likePost(db, liker2.id, post.id);

    // When
    const result = await countPostLikes(db, post.id);

    // Then
    expect(result).toBe(2);
  });
});
