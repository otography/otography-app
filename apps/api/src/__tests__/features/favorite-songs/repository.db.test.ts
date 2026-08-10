import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addFavoriteSong } from "../../../features/favorite-songs/repository";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db/client";
import { createSong, createUser } from "../../helpers/db/fixtures";
import { favoriteSongs } from "../../../shared/db/schema";

const sql = createTestSql();
const db = createTestDb(sql);

describe("addFavoriteSong", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  afterAll(async () => {
    await sql.end();
  });

  it("同じ楽曲を2回お気に入り登録しようとすると onConflictDoNothing により空配列を返す（409化は usecase 層の責務）", async () => {
    // Given
    const user = await createUser(db);
    const song = await createSong(db);

    await db.transaction(async (tx) => {
      await tx.insert(favoriteSongs).values({ userId: user.id, songId: song.id });

      // When
      const result = await addFavoriteSong(tx, user.id, song.id, {
        comment: null,
        emoji: null,
        color: null,
      });

      // Then
      expect(result).toEqual([]);
    });
  });
});
