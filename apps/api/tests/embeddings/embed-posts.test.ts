import { postEmbeddings, posts, users } from "db";
import { EMBEDDING_DIMENSIONS, EMBEDDING_INPUT_DIMENSIONS } from "db/constants";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import type { Transform } from "../../src/embeddings/transform.ts";
import { project } from "../../src/embeddings/transform.ts";
import { embedPosts } from "../../src/embeddings/usecases/embed-posts.ts";
import type { Embedder } from "../../src/embeddings/vector-store.ts";
import { decodeHalf, encodeHalf, fromHex, toHex } from "../../src/embeddings/vectors.ts";
import type { Database } from "../../src/lib/db.ts";
import { createTestDb } from "../helpers/db.ts";
import { memoryStore } from "../helpers/vector-store.ts";
import { createGaussian } from "../helpers/random.ts";

const gaussian = createGaussian(3);
const randomX = () => Float32Array.from({ length: EMBEDDING_INPUT_DIMENSIONS }, () => gaussian());
const transform: Transform = {
  model: "test-transform",
  a: Float32Array.from(
    { length: EMBEDDING_DIMENSIONS * EMBEDDING_INPUT_DIMENSIONS },
    () => gaussian() * 0.02,
  ),
  b: Float32Array.from({ length: EMBEDDING_DIMENSIONS }, () => gaussian() * 0.1),
};

let db: Database;
beforeEach(async () => {
  db = await createTestDb();
  await db
    .insert(users)
    .values({ id: "u", name: "u", email: "u@example.com", publicId: "u00000000001" });
  await db.insert(posts).values([
    { id: "p1", userId: "u", content: "一つ目" },
    { id: "p2", userId: "u", content: "二つ目" },
  ]);
});

describe("vectors", () => {
  test("半精度に変換して戻すと、元の値に近い", () => {
    const x = randomX();
    const back = decodeHalf(encodeHalf(x));
    expect(back).toHaveLength(x.length);
    for (let i = 0; i < 50; i++) expect(back[i]).toBeCloseTo(x[i]!, 2);
    expect(fromHex(toHex(encodeHalf(x)))).toEqual(encodeHalf(x));
  });
});

describe("embedPosts", () => {
  test("x を置き場所に入れ、変換があれば z を post_embeddings に入れる", async () => {
    const xs = [randomX(), randomX()];
    const embed: Embedder = async (texts) => texts.map((_, i) => xs[i]!);
    const { rows, store } = memoryStore();

    const result = await embedPosts({
      db,
      embed,
      store,
      transform,
      posts: [
        { id: "p1", content: "一つ目" },
        { id: "p2", content: "二つ目" },
      ],
    });
    expect(result).toEqual({ stored: 2, projected: 2 });
    expect(rows.get("p1")).toBe(xs[0]);

    const saved = await db.select().from(postEmbeddings).orderBy(postEmbeddings.postId);
    expect(saved.map((r) => r.model)).toEqual(["test-transform", "test-transform"]);
    const { z, norm } = project(transform, xs[0]!);
    expect(saved[0]?.norm).toBeCloseTo(norm, 6);
    expect(saved[0]?.embedding[0]).toBeCloseTo(z[0]!, 2);
  });

  test("変換が無ければ、x だけを入れる", async () => {
    const { rows, store } = memoryStore();
    const result = await embedPosts({
      db,
      embed: async (texts) => texts.map(() => randomX()),
      store,
      transform: null,
      posts: [{ id: "p1", content: "一つ目" }],
    });
    expect(result).toEqual({ stored: 1, projected: 0 });
    expect(rows.size).toBe(1);
    expect(await db.select().from(postEmbeddings)).toHaveLength(0);
  });

  test("埋め込みに失敗したら、エラーを返して何も入れない", async () => {
    const { rows, store } = memoryStore();
    const result = await embedPosts({
      db,
      embed: async () => new Error("失敗") as never,
      store,
      transform,
      posts: [{ id: "p1", content: "一つ目" }],
    });
    expect(result).toBeInstanceOf(Error);
    expect(rows.size).toBe(0);
  });
});
