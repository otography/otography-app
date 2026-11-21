import { createClient } from "@libsql/client";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, test } from "vite-plus/test";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  embeddingChanges,
  postEmbeddings,
  posts,
  relations,
  songs,
  users,
} from "../src/index.ts";

const client = createClient({ url: ":memory:" });
const db = drizzle({ client, relations });
const sortedIds = (rows: Array<{ id: string }> | undefined) => rows?.map((p) => p.id).sort();

const vector = (seed: number) =>
  Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => ((i + seed) % 7) / 8 - 0.25);
const embeddingRow = (postId: string, seed: number) => {
  const embedding = vector(seed);
  return { postId, embedding, norm: Math.hypot(...embedding), model: EMBEDDING_MODEL };
};

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
  await db.insert(postEmbeddings).values([embeddingRow("post1", 0), embeddingRow("post2", 3)]);
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
    const user = await db.query.users.findFirst({
      where: { id: "u1" },
      columns: { id: true },
      with: { posts: { columns: { id: true } }, allPosts: { columns: { id: true } } },
    });
    expect(sortedIds(user?.posts)).toEqual(["post1", "post2", "post3"]);
    expect(sortedIds(user?.allPosts)).toEqual(["deleted", "hidden", "post1", "post2", "post3"]);

    const song = await db.query.songs.findFirst({
      where: { isrc: "JPAB01234567" },
      columns: { isrc: true },
      with: { posts: { columns: { id: true } } },
    });
    expect(sortedIds(song?.posts)).toEqual(["post1", "post2", "post3"]);

    await db.delete(posts).where(inArray(posts.id, ["deleted", "hidden"]));
  });

  test("投稿を消すと埋め込みも消える", async () => {
    await db.insert(posts).values({ id: "post4", userId: "u1", content: "d" });
    await db.insert(postEmbeddings).values(embeddingRow("post4", 5));
    await db.delete(posts).where(eq(posts.id, "post4"));
    expect(
      await db.select().from(postEmbeddings).where(eq(postEmbeddings.postId, "post4")),
    ).toHaveLength(0);
  });

  test("埋め込みの追加・更新・削除が、統計の差分ログに記録される", async () => {
    await db.delete(embeddingChanges);
    await db.insert(posts).values({ id: "post5", userId: "u1", content: "e" });

    await db.insert(postEmbeddings).values(embeddingRow("post5", 1));
    await db
      .update(postEmbeddings)
      .set({ embedding: vector(2) })
      .where(eq(postEmbeddings.postId, "post5"));
    // 投稿の物理削除（ON DELETE CASCADE）で消えた埋め込みも記録される
    await db.delete(posts).where(eq(posts.id, "post5"));

    const changes = await db.select().from(embeddingChanges).orderBy(embeddingChanges.seq);
    expect(changes.map((c) => [c.sign, c.embedding.slice(0, 7)])).toEqual([
      [1, vector(1).slice(0, 7)], // 追加
      [-1, vector(1).slice(0, 7)], // 更新：前の値を引く
      [1, vector(2).slice(0, 7)], // 更新：新しい値を足す
      [-1, vector(2).slice(0, 7)], // 削除
    ]);
    expect(changes.every((c) => c.model === EMBEDDING_MODEL)).toBe(true);
  });

  test("CHECK 制約で不正な ISRC を弾く", async () => {
    await expect(
      db.insert(songs).values({ isrc: "short", appleSongId: "200", fetchedAt: new Date() }),
    ).rejects.toThrow();
  });
});
