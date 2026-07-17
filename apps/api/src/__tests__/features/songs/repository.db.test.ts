import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db/client";
import { createArtist, createGenre, createSong, linkSongGenre } from "../../helpers/db/fixtures";
import { artists, genres, songArtists, songGenres, songs } from "../../../shared/db/schema";
import { createSongFull } from "../../../features/songs/repository";

const sql = createTestSql();
const db = createTestDb(sql);

describe("genres と song_genres の同期", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
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

  it("soft-delete 済み song と同じ appleMusicId で createSongFull を呼ぶと復活させる", async () => {
    // Given: song 作成 → soft-delete
    const { id: deletedSongId } = await createSong(db, { appleMusicId: "am-deleted-song" });
    await db
      .update(songs)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(songs.id, deletedSongId));

    // When: 同じ appleMusicId で createSongFull を呼ぶ
    const result = await db.transaction(async (tx) =>
      createSongFull(tx, {
        songValues: {
          title: "Revived Song",
          appleMusicId: "am-deleted-song",
          length: null,
          isrcs: null,
        },
        artistIds: [],
        genreNames: [],
      }),
    );

    // Then: 復活した song が返る（constraint error ではなく）
    expect(result).not.toBeNull();
    expect(result!.id).toBe(deletedSongId);

    // deletedAt が null に戻っている
    const rows = await db
      .select({ deletedAt: songs.deletedAt })
      .from(songs)
      .where(eq(songs.id, deletedSongId));
    expect(rows[0]?.deletedAt).toBeNull();
  });

  it("同じ appleMusicId で createSongFull を 2 回呼んでも PK 違反にならず song が返る", async () => {
    // Given: アーティスト・ジャンルを用意
    const artist = await createArtist(db, { name: "Artist A" });
    const songValues = {
      title: "Repeat Song",
      appleMusicId: "am-repeat-song",
      length: null as number | null,
      isrcs: null as string | null,
    };

    // When: 同じ appleMusicId + 同じアーティスト/ジャンルで 2 回呼ぶ
    const first = await db.transaction(async (tx) =>
      createSongFull(tx, {
        songValues,
        artistIds: [artist.id],
        genreNames: ["Pop"],
      }),
    );
    const second = await db.transaction(async (tx) =>
      createSongFull(tx, {
        songValues,
        artistIds: [artist.id],
        genreNames: ["Pop"],
      }),
    );

    // Then: どちらも PK 違反にならず song が返る
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second!.id).toBe(first!.id);
  });

  it("再登録時に紐付けが最新データへ全置換される", async () => {
    // Given: 1 回目は アーティスト A + ジャンル "Pop"
    const artistA = await createArtist(db, { name: "Artist A" });
    const artistB = await createArtist(db, { name: "Artist B" });
    const songValues = {
      title: "Replace Song",
      appleMusicId: "am-replace-song",
      length: null as number | null,
      isrcs: null as string | null,
    };

    await db.transaction(async (tx) =>
      createSongFull(tx, {
        songValues,
        artistIds: [artistA.id],
        genreNames: ["Pop"],
      }),
    );

    // When: 2 回目は アーティスト B + ジャンル "Rock" で全置換
    const song = await db.transaction(async (tx) =>
      createSongFull(tx, {
        songValues,
        artistIds: [artistB.id],
        genreNames: ["Rock"],
      }),
    );

    // Then: song_artists / song_genres には B / "Rock" のみ残る
    expect(song).not.toBeNull();

    const linkedArtists = await db
      .select({ name: artists.name })
      .from(songArtists)
      .innerJoin(artists, eq(songArtists.artistId, artists.id))
      .where(eq(songArtists.songId, song!.id));
    expect(linkedArtists).toEqual([{ name: "Artist B" }]);

    const linkedGenres = await db
      .select({ name: genres.name })
      .from(songGenres)
      .innerJoin(genres, eq(songGenres.genreId, genres.id))
      .where(eq(songGenres.songId, song!.id));
    expect(linkedGenres).toEqual([{ name: "Rock" }]);
  });

  afterAll(async () => {
    await sql.end();
  });
});
