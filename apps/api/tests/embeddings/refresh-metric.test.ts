import { embeddingChanges, embeddingMetrics, postEmbeddings, posts, users } from "db";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "db/constants";
import { eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { loadMetric } from "../../src/embeddings/repository.ts";
import { searchSimilarPosts } from "../../src/embeddings/search.ts";
import {
  accumulate,
  emptyMoments,
  precisionNorm,
  toGeometry,
} from "../../src/embeddings/statistics.ts";
import { refreshEmbeddingMetric } from "../../src/embeddings/usecases/refresh-metric.ts";
import type { Database } from "../../src/lib/db.ts";
import { createTestDb } from "../helpers/db.ts";
import { createGaussian } from "../helpers/random.ts";

const k = EMBEDDING_DIMENSIONS;
const gaussian = createGaussian(11);
// 変換 A が想定した分布（平均 0、共分散 I）からずれたデータ
const sample = () => Array.from({ length: k }, (_, i) => 0.4 + gaussian() * (0.5 + i / k));
const options = { minCount: 300, threshold: 0.05, publish: true };

let db: Database;

const addEmbeddings = async (ids: string[]) => {
  await db.insert(posts).values(ids.map((id) => ({ id, userId: "author", content: id })));
  await db.insert(postEmbeddings).values(
    ids.map((postId) => {
      const embedding = sample();
      return { postId, embedding, norm: Math.hypot(...embedding), model: EMBEDDING_MODEL };
    }),
  );
};
const range = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => `p${from + i}`);
const storedEmbeddings = () =>
  db
    .select({
      postId: postEmbeddings.postId,
      embedding: postEmbeddings.embedding,
      pnormA: postEmbeddings.pnormA,
    })
    .from(postEmbeddings);

beforeEach(async () => {
  db = await createTestDb();
  await db
    .insert(users)
    .values({ id: "author", name: "投稿者", email: "a@example.com", publicId: "author000001" });
});

describe("refreshEmbeddingMetric", () => {
  test("行が足りない間は、ログだけ取り込んで計量を作らない", async () => {
    await addEmbeddings(range(0, 10));
    const result = await refreshEmbeddingMetric({ db, now: new Date(), ...options });
    expect(result).toMatchObject({
      refreshed: false,
      reason: "not_enough_rows",
      consumed: 10,
      count: 10,
    });
    expect(await db.select().from(embeddingChanges)).toHaveLength(0);
    expect(await loadMetric({ db, model: EMBEDDING_MODEL })).toBeNull();
  });

  test("計量を作って全行に pnorm を書き、切り替える。後から追加した行にも書く", async () => {
    await addEmbeddings(range(0, 400));
    const now = new Date("2026-11-19T00:00:00Z");
    const first = await refreshEmbeddingMetric({ db, now, graceMs: 0, ...options });
    expect(first).toMatchObject({ refreshed: true, version: 1, consumed: 400, written: 400 });

    // 保存された（F16 に丸めた）z から求めた計量でのノルムと一致する
    const rows = await storedEmbeddings();
    const moments = emptyMoments();
    for (const row of rows) accumulate(moments, row.embedding, 1);
    const geometry = toGeometry(moments);
    if (!geometry) throw new Error("計量を作れなかった");
    for (const row of rows.slice(0, 20)) {
      expect(row.pnormA).toBeCloseTo(precisionNorm(row.embedding, geometry), 6);
    }
    const metric = await loadMetric({ db, model: EMBEDDING_MODEL });
    expect(metric).toMatchObject({ version: 1, pnormColumn: "pnormA" });

    // 投稿を消して足しても、切り替えた直後（猶予の間）は計量を変えず、新しい行の pnorm だけ書く
    await db.delete(posts).where(inArray(posts.id, range(0, 50)));
    await addEmbeddings(range(400, 450));
    const second = await refreshEmbeddingMetric({
      db,
      now: new Date(now.getTime() + 60_000),
      ...options,
    });
    expect(second).toMatchObject({ refreshed: false, consumed: 100, filled: 50, count: 400 });
    const added = await db
      .select({ pnormA: postEmbeddings.pnormA })
      .from(postEmbeddings)
      .where(eq(postEmbeddings.postId, "p420"));
    expect(added[0]?.pnormA).toBeGreaterThan(0);

    // 計量が読めれば、検索はその計量で並べ直す
    if (metric instanceof Error || !metric) throw new Error("計量を読めなかった");
    const result = await searchSimilarPosts({ db, z: sample(), metric, limit: 5, candidates: 50 });
    expect(result).toHaveLength(5);
  }, 30_000);

  test("変化が小さければ、計量を作り直さない", async () => {
    await addEmbeddings(range(0, 400));
    await refreshEmbeddingMetric({ db, now: new Date(), graceMs: 0, ...options });
    const result = await refreshEmbeddingMetric({ db, now: new Date(), graceMs: 0, ...options });
    expect(result).toMatchObject({ refreshed: false, reason: "small_change", version: 1 });
    const [row] = await db.select({ version: embeddingMetrics.version }).from(embeddingMetrics);
    expect(row?.version).toBe(1);
  }, 30_000);

  test("publish が false なら、統計を積み上げるだけで計量を作らない", async () => {
    await addEmbeddings(range(0, 400));
    const result = await refreshEmbeddingMetric({
      db,
      now: new Date(),
      ...options,
      publish: false,
    });
    expect(result).toMatchObject({
      refreshed: false,
      reason: "publish_disabled",
      consumed: 400,
      count: 400,
    });
    expect(await loadMetric({ db, model: EMBEDDING_MODEL })).toBeNull();
  }, 30_000);
});
