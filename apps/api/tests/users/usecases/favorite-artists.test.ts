import { artists, favoriteArtists } from "db";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { CatalogArtist } from "../../../src/lib/apple-music/catalog.ts";
import { AppleArtistNotFoundError } from "../../../src/lib/apple-music/errors.ts";
import type { Database } from "../../../src/lib/db.ts";
import { DuplicateFavoriteArtistError } from "../../../src/users/errors.ts";
import { replaceFavoriteArtistsInput } from "../../../src/users/schemas.ts";
import { replaceFavoriteArtistsOfUser } from "../../../src/users/usecases/replace-favorite-artists.ts";
import { createTestDb } from "../../helpers/db.ts";
import { insertUser } from "../helpers.ts";

const catalog = new Map<string, CatalogArtist>([
  ["a1", { id: "a1", name: "アーティスト1", artworkUrl: null, url: null }],
  ["a2", { id: "a2", name: "アーティスト2", artworkUrl: null, url: null }],
]);

const fakeFetchArtist = () => {
  const fetchArtist = vi.fn(
    async (artistId: string) => catalog.get(artistId) ?? new AppleArtistNotFoundError({ artistId }),
  );
  return { calls: fetchArtist.mock.calls, fetchArtist };
};

const favorites = (items: Array<unknown>) => replaceFavoriteArtistsInput.parse({ items });

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
  await insertUser(db);
});

describe("replaceFavoriteArtistsOfUser", () => {
  test("未保存のアーティストを取得して保存し、配列の順でお気に入りにする", async () => {
    const { calls, fetchArtist } = fakeFetchArtist();
    const profile = await replaceFavoriteArtistsOfUser({
      db,
      fetchArtist,
      userId: "u1",
      input: favorites([{ artistId: "a2", emoji: "🎸" }, { artistId: "a1" }]),
    });

    if (profile instanceof Error) {
      throw profile;
    }
    expect(calls).toEqual([["a2"], ["a1"]]);
    expect(profile.favoriteArtists.map((f) => [f.artist.name, f.emoji])).toEqual([
      ["アーティスト2", "🎸"],
      ["アーティスト1", null],
    ]);
    expect(await db.select({ id: artists.id }).from(artists)).toHaveLength(2);
  });

  test("保存済みのアーティストは Apple を呼ばない", async () => {
    await replaceFavoriteArtistsOfUser({
      db,
      ...fakeFetchArtist(),
      userId: "u1",
      input: favorites([{ artistId: "a1" }]),
    });
    const { calls, fetchArtist } = fakeFetchArtist();
    await replaceFavoriteArtistsOfUser({
      db,
      fetchArtist,
      userId: "u1",
      input: favorites([{ artistId: "a1" }]),
    });
    expect(calls).toEqual([]);
  });

  test("同じアーティストを 2 回選ぶと、Apple を呼ばずにエラーを返す", async () => {
    const { calls, fetchArtist } = fakeFetchArtist();
    const result = await replaceFavoriteArtistsOfUser({
      db,
      fetchArtist,
      userId: "u1",
      input: favorites([{ artistId: "a1" }, { artistId: "a1" }]),
    });
    expect(result).toBeInstanceOf(DuplicateFavoriteArtistError);
    expect(calls).toEqual([]);
  });

  test("取得できないアーティストがあると、エラーを返して前の一覧を残す", async () => {
    await replaceFavoriteArtistsOfUser({
      db,
      ...fakeFetchArtist(),
      userId: "u1",
      input: favorites([{ artistId: "a1" }]),
    });
    const result = await replaceFavoriteArtistsOfUser({
      db,
      ...fakeFetchArtist(),
      userId: "u1",
      input: favorites([{ artistId: "zzz" }]),
    });
    expect(result).toBeInstanceOf(AppleArtistNotFoundError);
    expect(await db.select({ id: favoriteArtists.artistId }).from(favoriteArtists)).toEqual([
      { id: "a1" },
    ]);
  });
});
