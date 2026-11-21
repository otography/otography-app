import { USER_NAME_MAX, favoriteSongs } from "db";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import type { CatalogSong } from "../../../src/lib/apple-music/catalog.ts";
import { AppleSongNotFoundError } from "../../../src/lib/apple-music/errors.ts";
import type { Database } from "../../../src/lib/db.ts";
import { toDisplayName } from "../../../src/users/display-name.ts";
import { DuplicateFavoriteSongError, UserNotFoundError } from "../../../src/users/errors.ts";
import { getMe } from "../../../src/users/usecases/get-me.ts";
import { getProfile } from "../../../src/users/usecases/get-profile.ts";
import { replaceFavoriteSongsOfUser } from "../../../src/users/usecases/replace-favorite-songs.ts";
import { updateProfile } from "../../../src/users/usecases/update-profile.ts";
import { replaceFavoriteSongsInput } from "../../../src/users/schemas.ts";
import { createTestDb } from "../../helpers/db.ts";
import { insertUser } from "../helpers.ts";

const catalog = new Map<string, CatalogSong>([
  [
    "1",
    {
      isrc: "JPAA00000001",
      appleSongId: "1",
      title: "曲1",
      artistName: "A",
      albumName: null,
      durationMs: null,
      artworkUrl: null,
      url: null,
      artistIds: [],
    },
  ],
  [
    "2",
    {
      isrc: "JPAA00000002",
      appleSongId: "2",
      title: "曲2",
      artistName: "B",
      albumName: null,
      durationMs: null,
      artworkUrl: null,
      url: null,
      artistIds: [],
    },
  ],
]);
const fetchSong = async (songId: string) =>
  catalog.get(songId) ?? new AppleSongNotFoundError({ songId });

/** 入力のスキーマを通して、API が受け取るのと同じ形にする。 */
const favorites = (items: Array<unknown>) => replaceFavoriteSongsInput.parse({ items });

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
  await insertUser(db);
});

describe("getMe / updateProfile", () => {
  test("表示名と自己紹介を変えると、DB から読んだ新しい値を返す", async () => {
    const me = await updateProfile({
      db,
      userId: "u1",
      input: { name: "新しい名前", bio: "よろしく" },
    });
    if (me instanceof Error) {
      throw me;
    }
    expect(me).toEqual({
      name: "新しい名前",
      email: "a@example.com",
      image: null,
      publicId: "abc123def456",
      bio: "よろしく",
      isAdmin: false,
    });
    expect(await getMe({ db, userId: "u1" })).toEqual(me);
  });

  test("DB の CHECK 制約で、上限を超える表示名を保存しない", async () => {
    const me = await updateProfile({
      db,
      userId: "u1",
      input: { name: "あ".repeat(USER_NAME_MAX + 1) },
    });
    expect(me).toBeInstanceOf(Error);
  });
});

describe("toDisplayName", () => {
  test("登録時の表示名を、DB の制約に合う長さに切り、空なら仮の名前にする", () => {
    expect(toDisplayName("  山田 太郎 ")).toBe("山田 太郎");
    expect(Array.from(toDisplayName("あ".repeat(80))).length).toBe(USER_NAME_MAX);
    expect(toDisplayName("")).toBe("名前未設定");
  });
});

describe("getProfile", () => {
  test("利用停止中・存在しないユーザーは見つからない", async () => {
    await insertUser(db, {
      id: "u2",
      email: "b@example.com",
      publicId: "suspended000",
      suspendedAt: new Date(),
    });
    expect(await getProfile({ db, publicId: "suspended000" })).toBeInstanceOf(UserNotFoundError);
    expect(await getProfile({ db, publicId: "nobody000000" })).toBeInstanceOf(UserNotFoundError);
  });
});

describe("replaceFavoriteSongsOfUser", () => {
  test("お気に入りの曲を配列の順で保存し、メールアドレスを含まないプロフィールを返す", async () => {
    const profile = await replaceFavoriteSongsOfUser({
      db,
      fetchSong,
      userId: "u1",
      input: favorites([
        { songId: "2", isrc: "JPAA00000002", comment: "大好き", emoji: "😀", color: "blue" },
        { songId: "1", isrc: "JPAA00000001" },
      ]),
    });
    if (profile instanceof Error) {
      throw profile;
    }
    expect(profile).toEqual({
      publicId: "abc123def456",
      name: "テスト",
      image: null,
      bio: null,
      favoriteSongs: [
        {
          comment: "大好き",
          emoji: "😀",
          color: "blue",
          song: expect.objectContaining({ title: "曲2" }),
        },
        {
          comment: null,
          emoji: null,
          color: null,
          song: expect.objectContaining({ title: "曲1" }),
        },
      ],
      favoriteArtists: [],
    });
  });

  test("置き換えると、前の一覧は残らない。空の配列ですべて消せる", async () => {
    await replaceFavoriteSongsOfUser({
      db,
      fetchSong,
      userId: "u1",
      input: favorites([{ songId: "1", isrc: "JPAA00000001" }]),
    });
    const profile = await replaceFavoriteSongsOfUser({
      db,
      fetchSong,
      userId: "u1",
      input: favorites([]),
    });
    if (profile instanceof Error) {
      throw profile;
    }
    expect(profile.favoriteSongs).toEqual([]);
  });

  test("同じ曲を 2 回選ぶと、エラーを返して前の一覧を残す", async () => {
    await replaceFavoriteSongsOfUser({
      db,
      fetchSong,
      userId: "u1",
      input: favorites([{ songId: "1", isrc: "JPAA00000001" }]),
    });
    const result = await replaceFavoriteSongsOfUser({
      db,
      fetchSong,
      userId: "u1",
      input: favorites([
        { songId: "2", isrc: "JPAA00000002" },
        { songId: "2", isrc: "JPAA00000002" },
      ]),
    });
    expect(result).toBeInstanceOf(DuplicateFavoriteSongError);
    expect(await db.select({ isrc: favoriteSongs.songIsrc }).from(favoriteSongs)).toEqual([
      { isrc: "JPAA00000001" },
    ]);
  });

  test("曲を取得できないときは、エラーを返して前の一覧を残す", async () => {
    await replaceFavoriteSongsOfUser({
      db,
      fetchSong,
      userId: "u1",
      input: favorites([{ songId: "1", isrc: "JPAA00000001" }]),
    });
    const result = await replaceFavoriteSongsOfUser({
      db,
      fetchSong,
      userId: "u1",
      input: favorites([{ songId: "999", isrc: "JPAA00000999" }]),
    });
    expect(result).toBeInstanceOf(AppleSongNotFoundError);
    expect(await db.select({ isrc: favoriteSongs.songIsrc }).from(favoriteSongs)).toEqual([
      { isrc: "JPAA00000001" },
    ]);
  });
});
