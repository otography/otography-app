import { postIpLogs, posts, users } from "db";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import type { SessionUser } from "../../../src/auth/session.ts";
import type { CatalogSong } from "../../../src/lib/apple-music/catalog.ts";
import { AppleSongNotFoundError } from "../../../src/lib/apple-music/errors.ts";
import type { Database } from "../../../src/lib/db.ts";
import { MissingIpAddressError } from "../../../src/posts/errors.ts";
import { createPost } from "../../../src/posts/usecases/create-post.ts";
import { createTestDb } from "../../helpers/db.ts";

const song: CatalogSong = {
  isrc: "JPP302300157",
  appleSongId: "1679278167",
  title: "アイドル",
  artistName: "YOASOBI",
  albumName: "アイドル - Single",
  durationMs: 213000,
  artworkUrl: "https://example.com/{w}x{h}bb.jpg",
  url: "https://music.apple.com/jp/song/1679278167",
  artistIds: ["1490256993"],
};
const user = { id: "u1" } as SessionUser;
const input = { songId: song.appleSongId, isrc: song.isrc, content: "好きな曲" };

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
  await db
    .insert(users)
    .values({ id: "u1", name: "テスト", email: "a@example.com", publicId: "p1" });
});

describe("createPost", () => {
  test("曲を保存し、投稿と IP アドレスを保存して、応答の形で返す", async () => {
    const post = await createPost({
      db,
      fetchSong: async () => song,
      user,
      ipAddress: "203.0.113.1",
      input,
    });

    if (post instanceof Error) throw post;
    expect(post.id).toMatch(/^[a-z0-9]{12}$/);
    expect(post).toMatchObject({
      content: "好きな曲",
      song: { isrc: song.isrc, title: "アイドル" },
    });
    expect(post).not.toHaveProperty("userId");
    expect(await db.select().from(postIpLogs)).toMatchObject([
      { postId: post.id, userId: "u1", ipAddress: "203.0.113.1" },
    ]);
  });

  test("IP アドレスがないときは、Apple も呼ばず、何も保存しない", async () => {
    const calls: string[] = [];
    const post = await createPost({
      db,
      fetchSong: async (songId) => {
        calls.push(songId);
        return song;
      },
      user,
      ipAddress: null,
      input,
    });

    expect(post).toBeInstanceOf(MissingIpAddressError);
    expect(calls).toEqual([]);
    expect(await db.select().from(posts)).toEqual([]);
  });

  test("曲を取得できないときは、そのエラーを返して投稿を保存しない", async () => {
    const post = await createPost({
      db,
      fetchSong: async (songId) => new AppleSongNotFoundError({ songId }),
      user,
      ipAddress: "203.0.113.1",
      input,
    });

    expect(post).toBeInstanceOf(AppleSongNotFoundError);
    expect(await db.select().from(posts)).toEqual([]);
  });

  test("DB の CHECK 制約で、上限を超える本文を保存しない（API の検証を通らなかった場合の保険）", async () => {
    const post = await createPost({
      db,
      fetchSong: async () => song,
      user,
      ipAddress: "203.0.113.1",
      input: { ...input, content: "あ".repeat(141) },
    });

    expect(post).toBeInstanceOf(Error);
    expect(await db.select().from(posts)).toEqual([]);
    expect(await db.select().from(postIpLogs)).toEqual([]);
  });
});
