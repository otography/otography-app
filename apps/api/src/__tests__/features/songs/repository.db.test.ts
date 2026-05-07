import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db/client";
import { createSong, createGenre, linkSongGenre } from "../../helpers/db/fixtures";
import { genres, songGenres } from "../../../shared/db/schema";

const sql = createTestSql();
const db = createTestDb(sql);

describe("genres と song_genres の同期", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  afterAll(async () => {
    await sql.end();
  });

  it("ジャンルを作成して楽曲に紐付けられる", async () => {
    // Given
    const song = await createSong(db);
    const jpop = await createGenre(db, { name: "J-Pop" });
    const rock = await createGenre(db, { name: "Rock" });
    await linkSongGenre(db, song.id, jpop.id);
    await linkSongGenre(db, song.id, rock.id);

    // When
    const result = await db
      .select({ name: genres.name })
      .from(songGenres)
      .innerJoin(genres, eq(songGenres.genreId, genres.id))
      .where(eq(songGenres.songId, song.id));

    // Then
    expect(result.map((r) => r.name).sort()).toEqual(["J-Pop", "Rock"]);
  });

  it("楽曲のジャンル紐付けを全置換できる", async () => {
    // Given
    const song = await createSong(db);
    const pop = await createGenre(db, { name: "Pop" });
    const jazz = await createGenre(db, { name: "Jazz" });
    await linkSongGenre(db, song.id, pop.id);
    await linkSongGenre(db, song.id, jazz.id);

    // When: Jazz を外して Pop だけにする
    await db.delete(songGenres).where(eq(songGenres.songId, song.id));
    await linkSongGenre(db, song.id, pop.id);

    // Then
    const result = await db
      .select({ name: genres.name })
      .from(songGenres)
      .innerJoin(genres, eq(songGenres.genreId, genres.id))
      .where(eq(songGenres.songId, song.id));

    expect(result).toEqual([{ name: "Pop" }]);
  });
});
