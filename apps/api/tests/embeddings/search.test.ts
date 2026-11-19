import { postEmbeddings, posts, songs, users } from "db";
import { EMBEDDING_DIMENSIONS } from "db/constants";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vite-plus/test";
import type { Metric } from "../../src/embeddings/metric.ts";
import { searchSimilarPosts } from "../../src/embeddings/search.ts";
import type { Database } from "../../src/lib/db.ts";
import { createTestDb } from "../helpers/db.ts";
import { createGaussian } from "../helpers/random.ts";

const k = EMBEDDING_DIMENSIONS;
const N = 60;

const gaussian = createGaussian(42);
const randomVector = (scale = 1) => Array.from({ length: k }, () => gaussian() * scale);
const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
  return s;
};
const multiply = (P: Float32Array, v: ArrayLike<number>) =>
  Array.from({ length: k }, (_, i) => dot(P.subarray(i * k, (i + 1) * k), v));

// P = I + Σ v vᵀ（4 本）。対称で正定値なので、逆共分散として使える。
const precision = (() => {
  const P = new Float32Array(k * k);
  for (let i = 0; i < k; i++) P[i * k + i] = 1;
  for (let r = 0; r < 4; r++) {
    const v = randomVector(0.15);
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) P[i * k + j]! += v[i]! * v[j]!;
  }
  return P;
})();
const metric: Metric = {
  version: 1,
  mean: Float32Array.from(randomVector(0.3)),
  precision,
  pnormColumn: "pnormB",
};
const centered = (z: ArrayLike<number>) =>
  Array.from({ length: k }, (_, i) => z[i]! - metric.mean[i]!);
const pnorm = (z: ArrayLike<number>) =>
  Math.sqrt(dot(centered(z), multiply(precision, centered(z))));

let db: Database;
/** DB に保存された（F16 に丸めた）z。 */
let stored: Map<string, number[]>;

beforeAll(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "author", name: "投稿者", email: "a@example.com", publicId: "author000001" },
    {
      id: "banned",
      name: "停止中",
      email: "b@example.com",
      publicId: "banned000001",
      suspendedAt: new Date(),
    },
  ]);
  await db.insert(songs).values({ isrc: "JPAB01234567", appleSongId: "1", fetchedAt: new Date() });
  const ids = Array.from({ length: N }, (_, i) => `post${i}`);
  await db.insert(posts).values(
    ids.map((id, i) => ({
      id,
      userId: i === 1 ? "banned" : "author",
      content: id,
      hiddenAt: i === 2 ? new Date() : null,
      // post4〜post6 は同じ曲の投稿
      songIsrc: i >= 4 && i <= 6 ? "JPAB01234567" : null,
    })),
  );
  await db.insert(postEmbeddings).values(
    ids.map((postId) => {
      const embedding = randomVector();
      return { postId, embedding, norm: Math.hypot(...embedding), model: "test" };
    }),
  );
  const rows = await db
    .select({ postId: postEmbeddings.postId, embedding: postEmbeddings.embedding })
    .from(postEmbeddings);
  stored = new Map(rows.map((r) => [r.postId, r.embedding]));
  // バッチと同じく、この計量でのノルムを pnorm 列に書く。post3 は書かずに残す
  for (const [postId, z] of stored) {
    if (postId === "post3") continue;
    await db
      .update(postEmbeddings)
      .set({ pnormB: pnorm(z) })
      .where(eq(postEmbeddings.postId, postId));
  }
});

/** 見せてよい投稿（post1 は投稿者が停止中、post2 は非表示）を、スコアの大きい順に並べる。 */
const rank = (score: (z: number[]) => number, exclude: string[] = []) =>
  [...stored]
    .filter(([postId]) => !["post1", "post2", ...exclude].includes(postId))
    .map(([postId, z]) => ({ postId, score: score(z) }))
    .sort((a, b) => b.score - a.score);

describe("searchSimilarPosts", () => {
  test("計量があるとき、中心化・白色化したコサインの順に返す", async () => {
    const z = randomVector();
    const u = multiply(precision, centered(z));
    // post3 は pnorm を近似で計算するので、比べる対象から外す
    const expected = rank((zi) => dot(centered(zi), u) / pnorm(zi), ["post3"]).slice(0, 10);

    const result = await searchSimilarPosts({ db, z, metric, limit: N, candidates: N });
    if (result instanceof Error) throw result;
    const withoutApproximated = result.filter((r) => r.postId !== "post3").slice(0, 10);
    expect(withoutApproximated.map((r) => r.postId)).toEqual(expected.map((r) => r.postId));
    for (const [i, r] of withoutApproximated.entries()) {
      expect(r.score).toBeCloseTo(expected[i]!.score, 2);
    }
  });

  test("pnorm がまだ無い行も、近似したノルムで並べて返す", async () => {
    const result = await searchSimilarPosts({
      db,
      z: stored.get("post3")!,
      metric,
      limit: N,
      candidates: N,
    });
    if (result instanceof Error) throw result;
    expect(result.map((r) => r.postId)).toContain("post3");
  });

  test("計量が無いときは、z とのコサインの順に返す", async () => {
    const z = randomVector();
    const expected = rank((zi) => dot(zi, z) / (Math.hypot(...zi) * Math.hypot(...z))).slice(0, 10);

    const result = await searchSimilarPosts({ db, z, metric: null, limit: 10, candidates: N });
    if (result instanceof Error) throw result;
    expect(result.map((r) => r.postId)).toEqual(expected.map((r) => r.postId));
  });

  test("exclude を渡すと、その投稿と同じ曲の投稿を除く", async () => {
    const result = await searchSimilarPosts({
      db,
      z: stored.get("post4")!,
      metric: null,
      limit: N,
      candidates: N,
      exclude: { postId: "post4", songIsrc: "JPAB01234567" },
    });
    if (result instanceof Error) throw result;
    const ids = result.map((r) => r.postId);
    for (const id of ["post4", "post5", "post6"]) expect(ids).not.toContain(id);
    // 曲の無い投稿（songIsrc が NULL）は除かない
    expect(ids).toHaveLength(N - 2 - 3);
  });

  test("停止中のユーザーの投稿と、非表示の投稿は返さない", async () => {
    const result = await searchSimilarPosts({
      db,
      z: stored.get("post1")!,
      metric: null,
      limit: N,
      candidates: N,
    });
    if (result instanceof Error) throw result;
    const ids = result.map((r) => r.postId);
    expect(ids).not.toContain("post1");
    expect(ids).not.toContain("post2");
    expect(ids).toHaveLength(N - 2);
  });
});
