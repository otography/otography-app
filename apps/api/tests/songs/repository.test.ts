import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { CatalogSong } from "../../src/lib/apple-music/catalog.ts";
import { AppleSongNotFoundError } from "../../src/lib/apple-music/errors.ts";
import type { FetchCatalogSongError } from "../../src/lib/apple-music/errors.ts";
import type { Database } from "../../src/lib/db.ts";
import { getOrCreateSong } from "../../src/songs/repository.ts";
import { createTestDb } from "../helpers/db.ts";

const catalogSong = (overrides: Partial<CatalogSong> = {}): CatalogSong => ({
  isrc: "JPAB01234567",
  appleSongId: "100",
  title: "曲名",
  artistName: "歌手",
  albumName: null,
  durationMs: 200_000,
  artworkUrl: null,
  url: null,
  artistIds: ["a1"],
  ...overrides,
});

const fakeFetchSong = (result: FetchCatalogSongError | CatalogSong) => {
  const fetchSong = vi.fn(async (_songId: string) => result);
  return { calls: fetchSong.mock.calls, fetchSong };
};

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("getOrCreateSong", () => {
  test("未保存の曲は Apple から取得し、Apple が返した ISRC で保存する", async () => {
    const { calls, fetchSong } = fakeFetchSong(catalogSong({ isrc: "JPAB09999999" }));

    const song = await getOrCreateSong({ db, songId: "100", isrc: "JPAB01234567", fetchSong });

    expect(calls).toEqual([["100"]]);
    if (song instanceof Error) {
      throw song;
    }
    expect(song.isrc).toBe("JPAB09999999");
    expect(song.fetchedAt).toBeInstanceOf(Date);
    expect(await db.query.songs.findMany({ columns: { isrc: true } })).toEqual([
      { isrc: "JPAB09999999" },
    ]);
  });

  test("保存済みの曲は Apple を呼ばずに返す（ISRC の大文字・小文字は区別しない）", async () => {
    await getOrCreateSong({
      db,
      songId: "100",
      isrc: "JPAB01234567",
      ...fakeFetchSong(catalogSong()),
    });
    const { calls, fetchSong } = fakeFetchSong(new AppleSongNotFoundError({ songId: "200" }));

    const song = await getOrCreateSong({ db, songId: "200", isrc: "jpab01234567", fetchSong });

    expect(calls).toEqual([]);
    if (song instanceof Error) {
      throw song;
    }
    expect(song.appleSongId).toBe("100");
  });

  test("Apple から取得できないときは、そのエラーを返して何も保存しない", async () => {
    const { fetchSong } = fakeFetchSong(new AppleSongNotFoundError({ songId: "100" }));

    const song = await getOrCreateSong({ db, songId: "100", isrc: "JPAB01234567", fetchSong });

    expect(song).toBeInstanceOf(AppleSongNotFoundError);
    expect(await db.query.songs.findMany()).toEqual([]);
  });

  test("同じ曲が同時に保存されても、保存済みの行を返す", async () => {
    const results = await Promise.all([
      getOrCreateSong({ db, songId: "100", isrc: "JPAB01234567", ...fakeFetchSong(catalogSong()) }),
      getOrCreateSong({ db, songId: "100", isrc: "JPAB01234567", ...fakeFetchSong(catalogSong()) }),
    ]);

    for (const song of results) {
      if (song instanceof Error) {
        throw song;
      }
      expect(song.isrc).toBe("JPAB01234567");
    }
    expect(await db.query.songs.findMany()).toHaveLength(1);
  });
});
