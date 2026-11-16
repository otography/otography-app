import { createClient } from "@libsql/client";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, test } from "vite-plus/test";
import { EMBEDDING_DIMENSIONS, posts, relations, songs, users } from "../src/index.ts";

const client = createClient({ url: ":memory:" });
const db = drizzle({ client, relations });

const vector = (seed: number) =>
  Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => ((i + seed) % 7) / 8 - 0.25);

beforeAll(async () => {
  await client.execute("PRAGMA foreign_keys = ON");
  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });

  await db
    .insert(users)
    .values({ id: "u1", name: "テスト", email: "a@example.com", publicId: "p1" });
  await db.insert(songs).values({
    isrc: "JPAB01234567",
    appleSongId: "100",
    title: "曲",
    artistIds: ["a1"],
    fetchedAt: new Date(),
  });
  await db.insert(posts).values([
    { id: "post1", userId: "u1", songIsrc: "JPAB01234567", content: "a", embedding: vector(0) },
    { id: "post2", userId: "u1", songIsrc: "JPAB01234567", content: "b", embedding: vector(3) },
    { id: "post3", userId: "u1", songIsrc: "JPAB01234567", content: "c", embedding: null },
  ]);
});

describe("schema", () => {
  test("DB の列名はスネークケース、JS のキーはキャメルケース", async () => {
    const cols = await client.execute("PRAGMA table_info(posts)");
    expect(cols.rows.map((r) => r.name)).toContain("song_isrc");

    const [row] = await db
      .select({ songIsrc: posts.songIsrc, likeCount: posts.likeCount, createdAt: posts.createdAt })
      .from(posts)
      .where(eq(posts.id, "post1"));
    expect(row?.songIsrc).toBe("JPAB01234567");
    expect(row?.likeCount).toBe(0);
    expect(row?.createdAt).toBeInstanceOf(Date);
  });

  test("F16 ベクトルを書き込んで読み戻せる", async () => {
    const [row] = await db
      .select({ embedding: posts.embedding })
      .from(posts)
      .where(eq(posts.id, "post1"));
    expect(row?.embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(row?.embedding?.slice(0, 7)).toEqual(vector(0).slice(0, 7));
  });

  test("vector_top_k は embedding が NULL の投稿を返さない", async () => {
    const result = await db.all<{ id: string }>(sql`
      select p.id from vector_top_k('posts_embedding_idx', vector16(${JSON.stringify(vector(0))}), 10) v
      join ${posts} p on p.rowid = v.id
    `);
    const ids = result.map((r) => r.id);
    expect(ids[0]).toBe("post1");
    expect(ids).not.toContain("post3");
  });

  test("relations でユーザーの投稿と曲を引ける", async () => {
    const user = await db.query.users.findFirst({
      where: { id: "u1" },
      columns: { name: true },
      with: { posts: { columns: { id: true }, with: { song: { columns: { title: true } } } } },
    });
    expect(user?.posts).toHaveLength(3);
    expect(user?.posts[0]?.song?.title).toBe("曲");
  });

  test("CHECK 制約で不正な ISRC を弾く", async () => {
    await expect(
      db.insert(songs).values({ isrc: "short", appleSongId: "200", fetchedAt: new Date() }),
    ).rejects.toThrow();
  });
});
