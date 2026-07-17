import { eq, sql as drizzleSql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { RlsError } from "@repo/errors";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db/client";
import { createArtist, createGenre, createSong, createUser } from "../../helpers/db/fixtures";
import { withAnonymousRole, withAuthenticatedRole } from "../../../shared/db/rls";
import { findOrCreateArtists } from "../../../features/artists/repository";
import { createSongFull } from "../../../features/songs/repository";
import {
  artists,
  favoriteArtists,
  favoriteSongs,
  genres,
  songArtists,
  songGenres,
  songs,
  posts,
} from "../../../shared/db/schema";

const sql = createTestSql();
const db = createTestDb(sql);

afterAll(async () => {
  await sql.end();
});

describe("anon ロールのSELECTポリシー", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("anon はアクティブな楽曲を読める", async () => {
    // Given
    await createSong(db, { title: "Public Song" });

    // When
    const rows = await withAnonymousRole(db, (tx) => tx.select({ title: songs.title }).from(songs));

    // Then
    expect(rows).toEqual([{ title: "Public Song" }]);
  });

  it("anon はINSERTできない", async () => {
    // When
    const result = await withAnonymousRole(db, (tx) =>
      tx.insert(songs).values({ title: "Anon Song", appleMusicId: "am-anon" }).returning(),
    );

    // Then
    expect(result).toBeInstanceOf(Error);
  });

  it("論理削除されたジャンルは anon に見えない", async () => {
    // Given
    await createGenre(db, { name: "Active" });
    await createGenre(db, { name: "Deleted", deletedAt: new Date().toISOString() });

    // When
    const rows = await withAnonymousRole(db, (tx) => tx.select({ name: genres.name }).from(genres));

    // Then
    expect(rows).toEqual([{ name: "Active" }]);
  });

  it("論理削除されたアーティスト・楽曲は anon に見えない", async () => {
    // Given
    const deletedAt = new Date().toISOString();
    await createArtist(db, { name: "Active Artist" });
    await createArtist(db, { name: "Deleted Artist", deletedAt });
    await createSong(db, { title: "Active Song" });
    await createSong(db, { title: "Deleted Song", deletedAt });

    // When
    const artistRows = await withAnonymousRole(db, (tx) =>
      tx.select({ name: artists.name }).from(artists),
    );
    const songRows = await withAnonymousRole(db, (tx) =>
      tx.select({ title: songs.title }).from(songs),
    );

    // Then
    expect(artistRows).toEqual([{ name: "Active Artist" }]);
    expect(songRows).toEqual([{ title: "Active Song" }]);
  });
});

describe("authenticated ロールのINSERTポリシー", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("authenticated は楽曲・アーティスト紐付け・ジャンル紐付けをINSERTできる", async () => {
    // Given
    const artist = await createArtist(db, { name: "RLS Artist", appleMusicId: "am-rls-artist" });

    // When: 楽曲をINSERT
    const songResult = await withAuthenticatedRole(db, async (tx) => {
      const [s] = await tx
        .insert(songs)
        .values({ title: "RLS Song", appleMusicId: "am-rls-song" })
        .returning({ id: songs.id });
      return s;
    });
    expect(songResult).not.toBeInstanceOf(Error);
    const songId = (songResult as { id: string }).id;

    // When: song_artists をINSERT
    await withAuthenticatedRole(db, async (tx) => {
      await tx.insert(songArtists).values({ songId, artistId: artist.id, isGuest: false });
    });

    // When: song_genres をINSERT
    await withAuthenticatedRole(db, async (tx) => {
      await tx
        .insert(genres)
        .values({ name: "RLS Genre" })
        .onConflictDoNothing({ target: genres.name });
      const [g] = await tx
        .select({ id: genres.id })
        .from(genres)
        .where(eq(genres.name, "RLS Genre"));
      await tx.insert(songGenres).values({ songId, genreId: g!.id });
    });

    // Then: anon でも紐付け経由で読める
    const artistLinks = await withAnonymousRole(db, (tx) =>
      tx
        .select({ name: artists.name })
        .from(songArtists)
        .innerJoin(artists, eq(songArtists.artistId, artists.id))
        .where(eq(songArtists.songId, songId)),
    );
    expect(artistLinks).toEqual([{ name: "RLS Artist" }]);

    const genreLinks = await withAnonymousRole(db, (tx) =>
      tx
        .select({ name: genres.name })
        .from(songGenres)
        .innerJoin(genres, eq(songGenres.genreId, genres.id))
        .where(eq(songGenres.songId, songId)),
    );
    expect(genreLinks).toEqual([{ name: "RLS Genre" }]);
  });
});

describe("お気に入り系RLS: ユーザースコープ", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("authenticated は自分のお気に入りアーティストだけ取得できる", async () => {
    // Given
    const user1 = await createUser(db);
    const user2 = await createUser(db);
    const artist = await createArtist(db);
    await db.insert(favoriteArtists).values([
      { userId: user1.id, artistId: artist.id },
      { userId: user2.id, artistId: artist.id },
    ]);

    // When: user1 として取得
    const favArtists = await db.transaction(async (tx) => {
      await tx.execute(
        drizzleSql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: user1.id })}, true)`,
      );
      await tx.execute(drizzleSql.raw("set local role authenticated"));
      return tx.select({ userId: favoriteArtists.userId }).from(favoriteArtists);
    });

    // Then
    expect(favArtists).toEqual([{ userId: user1.id }]);
  });

  it("authenticated は自分のお気に入り楽曲だけ取得できる", async () => {
    // Given
    const user1 = await createUser(db);
    const user2 = await createUser(db);
    const song = await createSong(db);
    await db.insert(favoriteSongs).values([
      { userId: user1.id, songId: song.id },
      { userId: user2.id, songId: song.id },
    ]);

    // When: user1 として取得
    const favSongs = await db.transaction(async (tx) => {
      await tx.execute(
        drizzleSql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: user1.id })}, true)`,
      );
      await tx.execute(drizzleSql.raw("set local role authenticated"));
      return tx.select({ userId: favoriteSongs.userId }).from(favoriteSongs);
    });

    // Then
    expect(favSongs).toEqual([{ userId: user1.id }]);
  });
});

describe("投稿RLS: 論理削除フィルタ", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("anon はアクティブな投稿だけ見える", async () => {
    // Given
    const user = await createUser(db);
    const song = await createSong(db);
    await db.insert(posts).values([
      { userId: user.id, songId: song.id, content: "active" },
      { userId: user.id, songId: song.id, content: "deleted", deletedAt: new Date().toISOString() },
    ]);

    // When
    const rows = await withAnonymousRole(db, (tx) =>
      tx.select({ content: posts.content }).from(posts),
    );

    // Then
    expect(rows).toEqual([{ content: "active" }]);
  });
});

describe("カタログ論理削除保護: authenticated ロールは deletedAt を UPDATE できない", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("authenticated は artists の deletedAt を UPDATE できない", async () => {
    // Given: アクティブなアーティスト
    const artist = await createArtist(db, { name: "Target Artist" });

    // When: authenticated ロールで deletedAt をセット
    const result = await withAuthenticatedRole(db, (tx) =>
      tx
        .update(artists)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(artists.id, artist.id)),
    );

    // Then: RlsError が返る
    expect(result).toBeInstanceOf(RlsError);

    // DB は不変（deletedAt が null のまま）
    const [row] = await db
      .select({ deletedAt: artists.deletedAt })
      .from(artists)
      .where(eq(artists.id, artist.id));
    expect(row?.deletedAt).toBeNull();
  });

  it("authenticated は songs の deletedAt を UPDATE できない", async () => {
    // Given
    const song = await createSong(db, { title: "Target Song" });

    // When
    const result = await withAuthenticatedRole(db, (tx) =>
      tx.update(songs).set({ deletedAt: new Date().toISOString() }).where(eq(songs.id, song.id)),
    );

    // Then
    expect(result).toBeInstanceOf(RlsError);
    const [row] = await db
      .select({ deletedAt: songs.deletedAt })
      .from(songs)
      .where(eq(songs.id, song.id));
    expect(row?.deletedAt).toBeNull();
  });

  it("authenticated は genres の deletedAt を UPDATE できない", async () => {
    // Given
    const genre = await createGenre(db, { name: "Target Genre" });

    // When
    const result = await withAuthenticatedRole(db, (tx) =>
      tx.update(genres).set({ deletedAt: new Date().toISOString() }).where(eq(genres.id, genre.id)),
    );

    // Then
    expect(result).toBeInstanceOf(RlsError);
    const [row] = await db
      .select({ deletedAt: genres.deletedAt })
      .from(genres)
      .where(eq(genres.id, genre.id));
    expect(row?.deletedAt).toBeNull();
  });

  it("authenticated はアクティブな artists の name を UPDATE できる（同期パス保証）", async () => {
    // Given
    const artist = await createArtist(db, { name: "Old Name" });

    // When
    const result = await withAuthenticatedRole(db, (tx) =>
      tx
        .update(artists)
        .set({ name: "New Name" })
        .where(eq(artists.id, artist.id))
        .returning({ name: artists.name }),
    );

    // Then
    if (result instanceof Error) throw result;
    expect(result[0]?.name).toBe("New Name");
  });

  it("findOrCreateArtists は論理削除済みアーティストを復活できる", async () => {
    // Given: 論理削除済みアーティスト（owner 権限で直接作成）
    const deleted = await createArtist(db, {
      name: "Old Name",
      appleMusicId: "am-revive-1",
      deletedAt: new Date().toISOString(),
    });

    // When: findOrCreateArtists で復活アップサート（authenticated ロール）
    const result = await withAuthenticatedRole(db, (tx) =>
      findOrCreateArtists(tx, [{ appleMusicId: "am-revive-1", name: "New Name" }]),
    );

    // Then: 既存行の ID がエラーなく返る
    if (result instanceof Error) throw result;
    expect(result).toEqual([deleted.id]);

    // DB の行は復活している
    const [row] = await db
      .select({ name: artists.name, deletedAt: artists.deletedAt })
      .from(artists)
      .where(eq(artists.appleMusicId, "am-revive-1"));
    expect(row?.name).toBe("New Name");
    expect(row?.deletedAt).toBeNull();
  });

  it("createSongFull は論理削除済み楽曲を復活できる", async () => {
    // Given: 論理削除済み楽曲（owner 権限で直接作成）
    await createSong(db, {
      title: "Old Title",
      appleMusicId: "am-song-revive-1",
      deletedAt: new Date().toISOString(),
    });

    // When: 再登録アップサート（authenticated ロール = registerSong と同じ経路）
    const result = await withAuthenticatedRole(db, (tx) =>
      createSongFull(tx, {
        songValues: {
          title: "New Title",
          appleMusicId: "am-song-revive-1",
          length: null,
          isrcs: null,
        },
        artistIds: [],
        genreNames: [],
      }),
    );

    // Then: エラーなく楽曲が返る
    if (result instanceof Error) throw result;
    expect(result).toMatchObject({ title: "New Title" });

    // DB の行は復活している
    const [row] = await db
      .select({ title: songs.title, deletedAt: songs.deletedAt })
      .from(songs)
      .where(eq(songs.appleMusicId, "am-song-revive-1"));
    expect(row?.title).toBe("New Title");
    expect(row?.deletedAt).toBeNull();
  });
});
