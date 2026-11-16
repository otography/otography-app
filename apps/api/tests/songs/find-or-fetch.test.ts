import { createClient } from "@libsql/client";
import { relations } from "db";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import {
  AppleSongNotFoundError,
  type CatalogSong,
  type FetchCatalogSongError,
} from "../../src/songs/apple-music/catalog.ts";
import type { Database } from "../../src/lib/db.ts";
import { findOrFetchSong } from "../../src/songs/find-or-fetch.ts";

const catalogSong = (overrides: Partial<CatalogSong> = {}): CatalogSong => ({
  isrc: "JPAB01234567",
  appleSongId: "100",
  title: "曲名",
  artistName: "歌手",
  albumName: null,
  durationMs: 200000,
  artworkUrl: null,
  url: null,
  artistIds: ["a1"],
  ...overrides,
});

const fakeFetchSong = (result: FetchCatalogSongError | CatalogSong) => {
  const calls: string[] = [];
  const fetchSong = async (songId: string) => {
    calls.push(songId);
    return result;
  };
  return { calls, fetchSong };
};

let db: Database;

beforeEach(async () => {
  const client = createClient({ url: ":memory:" });
  const local = drizzle({ client, relations });
  await migrate(local, {
    migrationsFolder: new URL("../../../../packages/db/migrations", import.meta.url).pathname,
  });
  db = local as unknown as Database;
});

describe("findOrFetchSong", () => {
  test("未保存の曲は Apple から取得し、Apple が返した ISRC で保存する", async () => {
    const { calls, fetchSong } = fakeFetchSong(catalogSong({ isrc: "JPAB09999999" }));

    const song = await findOrFetchSong({ db, songId: "100", isrc: "JPAB01234567", fetchSong });

    expect(calls).toEqual(["100"]);
    if (song instanceof Error) throw song;
    expect(song.isrc).toBe("JPAB09999999");
    expect(song.fetchedAt).toBeInstanceOf(Date);
    expect(await db.query.songs.findMany({ columns: { isrc: true } })).toEqual([
      { isrc: "JPAB09999999" },
    ]);
  });

  test("保存済みの曲は Apple を呼ばずに返す（ISRC の大文字・小文字は区別しない）", async () => {
    await findOrFetchSong({
      db,
      songId: "100",
      isrc: "JPAB01234567",
      ...fakeFetchSong(catalogSong()),
    });
    const { calls, fetchSong } = fakeFetchSong(new AppleSongNotFoundError({ songId: "200" }));

    const song = await findOrFetchSong({ db, songId: "200", isrc: "jpab01234567", fetchSong });

    expect(calls).toEqual([]);
    if (song instanceof Error) throw song;
    expect(song.appleSongId).toBe("100");
  });

  test("Apple から取得できないときは、そのエラーを返して何も保存しない", async () => {
    const { fetchSong } = fakeFetchSong(new AppleSongNotFoundError({ songId: "100" }));

    const song = await findOrFetchSong({ db, songId: "100", isrc: "JPAB01234567", fetchSong });

    expect(song).toBeInstanceOf(AppleSongNotFoundError);
    expect(await db.query.songs.findMany()).toEqual([]);
  });

  test("同じ曲が同時に保存されても、保存済みの行を返す", async () => {
    const results = await Promise.all([
      findOrFetchSong({ db, songId: "100", isrc: "JPAB01234567", ...fakeFetchSong(catalogSong()) }),
      findOrFetchSong({ db, songId: "100", isrc: "JPAB01234567", ...fakeFetchSong(catalogSong()) }),
    ]);

    for (const song of results) {
      if (song instanceof Error) throw song;
      expect(song.isrc).toBe("JPAB01234567");
    }
    expect(await db.query.songs.findMany()).toHaveLength(1);
  });
});
