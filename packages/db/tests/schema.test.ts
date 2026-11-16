import { createClient } from "@libsql/client";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, test } from "vite-plus/test";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  postEmbeddings,
  posts,
  relations,
  songs,
  users,
} from "../src/index.ts";

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
    { id: "post1", userId: "u1", songIsrc: "JPAB01234567", content: "a" },
    { id: "post2", userId: "u1", songIsrc: "JPAB01234567", content: "b" },
    { id: "post3", userId: "u1", songIsrc: "JPAB01234567", content: "c" }, // 埋め込みなし
  ]);
  await db.insert(postEmbeddings).values([
    { postId: "post1", embedding: vector(0), model: EMBEDDING_MODEL },
    { postId: "post2", embedding: vector(3), model: EMBEDDING_MODEL },
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
      .select({ embedding: postEmbeddings.embedding })
      .from(postEmbeddings)
      .where(eq(postEmbeddings.postId, "post1"));
    expect(row?.embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(row?.embedding.slice(0, 7)).toEqual(vector(0).slice(0, 7));
  });

  test("vector_top_k は埋め込みのある投稿だけを近い順に返す", async () => {
    const result = await db.all<{ id: string }>(sql`
      select p.id from vector_top_k('post_embeddings_vector_idx', vector16(${JSON.stringify(vector(0))}), 10) v
      join ${postEmbeddings} e on e.rowid = v.id
      join ${posts} p on p.id = e.post_id
    `);
    expect(result.map((r) => r.id)).toEqual(["post1", "post2"]);
  });

  test("relations で投稿・曲・埋め込みを入れ子で引ける", async () => {
    const user = await db.query.users.findFirst({
      where: { id: "u1" },
      columns: { name: true },
      with: {
        posts: {
          columns: { id: true },
          orderBy: { id: "asc" },
          with: { song: { columns: { title: true } }, embedding: true },
        },
      },
    });
    expect(user?.posts).toHaveLength(3);
    expect(user?.posts[0]?.song?.title).toBe("曲");
    // JSON の中に入る経路（codec の hex 変換）でもベクトルに戻る
    expect(user?.posts[0]?.embedding?.embedding.slice(0, 7)).toEqual(vector(0).slice(0, 7));
    expect(user?.posts[2]?.embedding).toBeNull();
  });

  test("リレーションの posts は削除・非表示の投稿を返さず、allPosts は返す", async () => {
    await db.insert(posts).values([
      {
        id: "deleted",
        userId: "u1",
        songIsrc: "JPAB01234567",
        content: "x",
        deletedAt: new Date(),
      },
      { id: "hidden", userId: "u1", songIsrc: "JPAB01234567", content: "y", hiddenAt: new Date() },
    ]);
    const ids = (rows: { id: string }[] | undefined) => rows?.map((p) => p.id).sort();

    const user = await db.query.users.findFirst({
      where: { id: "u1" },
      columns: { id: true },
      with: { posts: { columns: { id: true } }, allPosts: { columns: { id: true } } },
    });
    expect(ids(user?.posts)).toEqual(["post1", "post2", "post3"]);
    expect(ids(user?.allPosts)).toEqual(["deleted", "hidden", "post1", "post2", "post3"]);

    const song = await db.query.songs.findFirst({
      where: { isrc: "JPAB01234567" },
      columns: { isrc: true },
      with: { posts: { columns: { id: true } } },
    });
    expect(ids(song?.posts)).toEqual(["post1", "post2", "post3"]);

    await db.delete(posts).where(inArray(posts.id, ["deleted", "hidden"]));
  });

  test("投稿を消すと埋め込みも消える", async () => {
    await db.insert(posts).values({ id: "post4", userId: "u1", content: "d" });
    await db
      .insert(postEmbeddings)
      .values({ postId: "post4", embedding: vector(5), model: EMBEDDING_MODEL });
    await db.delete(posts).where(eq(posts.id, "post4"));
    expect(
      await db.select().from(postEmbeddings).where(eq(postEmbeddings.postId, "post4")),
    ).toHaveLength(0);
  });

  test("CHECK 制約で不正な ISRC を弾く", async () => {
    await expect(
      db.insert(songs).values({ isrc: "short", appleSongId: "200", fetchedAt: new Date() }),
    ).rejects.toThrow();
  });
});
