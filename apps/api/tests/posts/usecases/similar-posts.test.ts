import { postEmbeddings, posts, postSimilarCacheItems, postSimilarCaches, songs, users } from "db";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_INPUT_DIMENSIONS,
  SIMILAR_CACHE_TTL_MS,
} from "db/constants";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { EmbeddingUnavailableError } from "../../../src/embeddings/errors.ts";
import type { Transform } from "../../../src/embeddings/transform.ts";
import { embedPosts } from "../../../src/embeddings/usecases/embed-posts.ts";
import type { Embedder } from "../../../src/embeddings/vector-store.ts";
import type { Database } from "../../../src/lib/db.ts";
import { PostNotFoundError } from "../../../src/posts/errors.ts";
import { getSimilarPosts, searchPosts } from "../../../src/posts/usecases/similar-posts.ts";
import { createTestDb } from "../../helpers/db.ts";
import { memoryStore } from "../../helpers/vector-store.ts";
import { createGaussian } from "../../helpers/random.ts";

const gaussian = createGaussian(7);
const D = EMBEDDING_INPUT_DIMENSIONS;
const K = EMBEDDING_DIMENSIONS;
const randomX = () => Float32Array.from({ length: D }, () => gaussian());
const transform: Transform = {
  model: "test-transform",
  a: Float32Array.from({ length: K * D }, () => gaussian() * 0.02),
  b: new Float32Array(K),
};

// 本文ごとの x。「近い」は「元」に小さな揺らぎを足したもの。
const base = randomX();
const near = (scale: number) => base.map((v) => v + gaussian() * scale);
const xOf = new Map<string, Float32Array>([
  ["元", base],
  ["同じ曲で近い", near(0.05)],
  ["近い", near(0.1)],
  ["やや近い", near(0.6)],
  ["遠い1", randomX()],
  ["遠い2", randomX()],
  ["非表示で近い", near(0.05)],
]);

const calls: string[][] = [];
const embed: Embedder = async (texts) => {
  calls.push(texts);
  return texts.map((text) => xOf.get(text) ?? randomX());
};
let db: Database;
let store: ReturnType<typeof memoryStore>;
beforeEach(async () => {
  calls.length = 0;
  store = memoryStore();
  db = await createTestDb();
  await db
    .insert(users)
    .values({ id: "u", name: "u", email: "u@example.com", publicId: "u00000000001" });
  const now = new Date();
  await db.insert(songs).values([
    { isrc: "JPAA00000001", appleSongId: "1", fetchedAt: now },
    { isrc: "JPAA00000002", appleSongId: "2", fetchedAt: now },
  ]);
  const rows = [
    { id: "origin", content: "元", songIsrc: "JPAA00000001" },
    { id: "samesong", content: "同じ曲で近い", songIsrc: "JPAA00000001" },
    { id: "close", content: "近い", songIsrc: "JPAA00000002" },
    { id: "mid", content: "やや近い", songIsrc: "JPAA00000002" },
    { id: "far1", content: "遠い1", songIsrc: "JPAA00000002" },
    { id: "far2", content: "遠い2", songIsrc: null },
    { id: "hidden", content: "非表示で近い", songIsrc: "JPAA00000002", hiddenAt: now },
  ];
  await db.insert(posts).values(rows.map((row) => ({ ...row, userId: "u" })));
  // origin 以外は、埋め込みのバッチが作ったものとして先に入れておく
  const embedded = await embedPosts({
    db,
    embed,
    store: store.store,
    transform,
    posts: rows.filter((row) => row.id !== "origin"),
  });
  if (embedded instanceof Error) throw embedded;
  calls.length = 0;
});

describe("getSimilarPosts", () => {
  test("近い順に 3 件返し、その投稿自身・同じ曲・見せられない投稿は除く", async () => {
    const result = await getSimilarPosts({
      db,
      embedding: { embed, store: store.store, transform },
      postId: "origin",
      viewerId: "u",
      includeSameSong: false,
    });
    if (result instanceof Error) throw result;
    expect(result.expired).toBe(false);
    expect(result.posts.map((post) => post.id)).toEqual(["close", "mid", expect.any(String)]);
    expect(result.posts.map((post) => post.id)).not.toContain("samesong");
    expect(result.posts.map((post) => post.id)).not.toContain("hidden");
    expect(result.posts[0]?.author.publicId).toBe("u00000000001");
  });

  test("includeSameSong が true なら、同じ曲の感想も含める", async () => {
    const result = await getSimilarPosts({
      db,
      embedding: { embed, store: store.store, transform },
      postId: "origin",
      viewerId: "u",
      includeSameSong: true,
    });
    if (result instanceof Error) throw result;
    expect(result.expired).toBe(false);
    expect(result.posts.map((post) => post.id)).toEqual(["samesong", "close", "mid"]);
  });

  test("24 時間以内はキャッシュテーブルに保存し、2 回目は検索せずキャッシュから返す（非表示になった投稿は除外）", async () => {
    const first = await getSimilarPosts({
      db,
      embedding: { embed, store: store.store, transform },
      postId: "origin",
      viewerId: "u",
      includeSameSong: false,
    });
    if (first instanceof Error) throw first;

    const caches = await db.select().from(postSimilarCaches);
    const items = await db.select().from(postSimilarCacheItems);
    expect(caches).toHaveLength(1);
    expect(items).toHaveLength(3);

    // 1 件を非表示にしても、キャッシュからハイドレート時に除外される
    await db.update(posts).set({ hiddenAt: new Date() }).where(eq(posts.id, "close"));

    calls.length = 0;
    const second = await getSimilarPosts({
      db,
      embedding: { embed, store: store.store, transform: null },
      postId: "origin",
      viewerId: "u",
      includeSameSong: false,
    });
    if (second instanceof Error) throw second;
    expect(calls).toEqual([]);
    expect(second.expired).toBe(false);
    expect(second.posts.map((post) => post.id)).not.toContain("close");
    expect(second.posts.map((post) => post.id)).toContain("mid");
  });

  test("24 時間を過ぎた投稿は再検索せず expired: true を返す", async () => {
    const after24h = new Date(Date.now() + SIMILAR_CACHE_TTL_MS + 1000);
    const result = await getSimilarPosts({
      db,
      embedding: { embed, store: store.store, transform },
      postId: "origin",
      viewerId: "u",
      includeSameSong: false,
      now: after24h,
    });
    if (result instanceof Error) throw result;
    expect(result.expired).toBe(true);
    expect(result.posts).toEqual([]);
    expect(calls).toEqual([]);
  });

  test("埋め込みがまだ無い投稿は、その場で作って保存する", async () => {
    const result = await getSimilarPosts({
      db,
      embedding: { embed, store: store.store, transform },
      postId: "origin",
      viewerId: "u",
      includeSameSong: false,
    });
    if (result instanceof Error) throw result;
    expect(calls).toEqual([["元"]]);
    expect(store.rows.has("origin")).toBe(true);
    const saved = await db.select().from(postEmbeddings);
    expect(saved.map((row) => row.postId)).toContain("origin");

    // 2 回目は保存した z を使い、Workers AI を呼ばない
    calls.length = 0;
    await getSimilarPosts({
      db,
      embedding: { embed, store: store.store, transform },
      postId: "origin",
      viewerId: "u",
      includeSameSong: false,
    });
    expect(calls).toEqual([]);
  });

  test("見せられない投稿なら PostNotFoundError を返す", async () => {
    const result = await getSimilarPosts({
      db,
      embedding: { embed, store: store.store, transform },
      postId: "hidden",
      viewerId: "u",
      includeSameSong: false,
    });
    expect(result).toBeInstanceOf(PostNotFoundError);
  });

  test("変換がまだ無ければ EmbeddingUnavailableError を返す", async () => {
    const result = await getSimilarPosts({
      db,
      embedding: { embed, store: store.store, transform: null },
      postId: "origin",
      viewerId: "u",
      includeSameSong: false,
    });
    expect(result).toBeInstanceOf(EmbeddingUnavailableError);
  });
});

describe("searchPosts", () => {
  test("言葉に近い感想から順に返す。見せられない投稿は除く", async () => {
    // 「元」と同じ x になる言葉で探すので、同じ曲の投稿も含めて近い順に並ぶ
    const result = await searchPosts({
      db,
      embedding: { embed, store: store.store, transform },
      text: "元",
      viewerId: "u",
    });
    if (result instanceof Error) throw result;
    const ids = result.map((post) => post.id);
    expect(ids.slice(0, 3)).toEqual(["samesong", "close", "mid"]);
    expect(ids).not.toContain("hidden");
    // 言葉の x は D1 に入れない
    expect(store.rows.size).toBe(6);
  });
});
