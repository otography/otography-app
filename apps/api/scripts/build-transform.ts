/**
 * 変換 z = Ax + b（2048 → 256 次元）を作り、効果を評価して、Turso の embedding_transforms に入れる（MUS-78）。
 * GitHub Actions（.github/workflows/build-transform.yml）から実行する。
 *
 * 投稿は音楽の感想なので、A も公式アカウントの曲の感想の x（D1 にある）から作る。Workers AI は使わない。
 *
 * 1. 評価：曲ごとに約 8 割と 2 割に分け、8 割の曲の感想で A を作り、残り 2 割の曲の感想で評価する。
 *    同じ曲の別の感想が、コサインで上位 10 件に入るか（hit@10）と、最初に出る順位の逆数の平均（MRR）を、
 *    2048 次元のまま、射影だけ（pca）、白色化（white）で比べる。曲単位で分けるので、評価の曲は学習に入らない
 * 2. 本番用：すべての感想で作り直した 2 つの変換を Turso に入れる。どちらを使うかは、評価を見て
 *    db/constants の EMBEDDING_MODEL で選ぶ
 *    - plamo-1b:pca256-v1：上位 256 方向に射影するだけ（A = Uᵀ）
 *    - plamo-1b:white256-v1：射影して、方向ごとの分散をそろえる（A = (Λ + τI)^(-1/2) Uᵀ）
 *
 * 感想は 2048 次元に対して件数が少なく、分散の小さい方向の推定が不安定になる。白色化はそこを大きく引き伸ばすので、
 * すべての方向の分散に、全次元の平均の分散 τ を足してから割る（収縮）。
 * 必要な環境変数：TURSO_DATABASE_URL、TURSO_AUTH_TOKEN、CLOUDFLARE_ACCOUNT_ID、WORKERS_AI_API_TOKEN、X_STORE_NAME
 */
import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";
import { embeddingTransforms, posts, relations } from "db";
import { EMBEDDING_DIMENSIONS, EMBEDDING_INPUT_DIMENSIONS } from "db/constants";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { float32Bytes } from "../src/embeddings/vectors.ts";
import { restVectorStore } from "./lib/cloudflare.ts";
import { covariance, topEigen } from "./lib/pca.ts";

const OFFICIAL_USER_ID = "official-otography";
const D = EMBEDDING_INPUT_DIMENSIONS;
const K = EMBEDDING_DIMENSIONS;
/** 評価に回す曲の割合。 */
const TEST_RATIO = 0.2;

function fail(error: Error): never {
  console.error(error);
  process.exit(1);
}

const db = drizzle({
  client: createClient({
    url: process.env.TURSO_DATABASE_URL || "http://127.0.0.1:8080",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  }),
  relations,
});

// 公式アカウントの感想と、D1 にある x
const store = await restVectorStore(process.env.X_STORE_NAME ?? "x-store-staging-01");
if (store instanceof Error) fail(store);
const reviews = await db
  .select({ id: posts.id, isrc: posts.songIsrc })
  .from(posts)
  .where(eq(posts.userId, OFFICIAL_USER_ID));
const xs = await store.get(reviews.map((r) => r.id));
if (xs instanceof Error) fail(xs);
const items = reviews.flatMap((r) => {
  const x = xs.get(r.id);
  return x && r.isrc ? [{ isrc: r.isrc, x }] : [];
});
if (items.length <= D)
  fail(
    new Error(
      `x のある感想が少なすぎます（${items.length} 件）。先に Embed posts を実行してください`,
    ),
  );

// 曲ごとに分ける。ISRC のハッシュで決めるので、何度実行しても同じ分け方になる。
const isTest = (isrc: string) =>
  createHash("sha256").update(isrc).digest().readUInt32BE(0) / 2 ** 32 < TEST_RATIO;
const train = items.filter((item) => !isTest(item.isrc));
const test = items.filter((item) => isTest(item.isrc));

type Transform = { a: Float32Array; b: Float32Array };

/** x の集まりから、射影だけの変換と、白色化（収縮つき）の変換を作る。 */
function fit(rows: Float32Array[]) {
  const { mean, c } = covariance(rows, D);
  const { values, vectors } = topEigen(c, D, K);
  let total = 0;
  for (let i = 0; i < D; i++) total += c[i * D + i]!;
  const tau = total / D;
  const build = (scaleOf: (r: number) => number): Transform => {
    const a = new Float32Array(K * D);
    const b = new Float32Array(K);
    for (let r = 0; r < K; r++) {
      const scale = scaleOf(r);
      let bias = 0;
      for (let j = 0; j < D; j++) {
        const v = vectors[r * D + j]! * scale;
        a[r * D + j] = v;
        bias -= v * mean[j]!;
      }
      b[r] = bias;
    }
    return { a, b };
  };
  return {
    explained: values.reduce((s, v) => s + v, 0) / total,
    pca: build(() => 1),
    white: build((r) => 1 / Math.sqrt(values[r]! + tau)),
  };
}

const projectWith = (t: Transform) => (x: Float32Array) => {
  const z = new Float64Array(K);
  for (let r = 0; r < K; r++) {
    let acc = t.b[r]!;
    for (let j = 0; j < D; j++) acc += t.a[r * D + j]! * x[j]!;
    z[r] = acc;
  }
  return z;
};

const normalize = (v: ArrayLike<number>) => {
  const out = Float64Array.from(v);
  const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0)) || 1;
  return out.map((x) => x / norm);
};

/** 評価の感想の中で、同じ曲の別の感想を探す。 */
function evaluate(set: typeof items, vectorOf: (x: Float32Array) => ArrayLike<number>) {
  const vs = set.map((item) => normalize(vectorOf(item.x)));
  let hits = 0;
  let reciprocal = 0;
  let queries = 0;
  for (let i = 0; i < set.length; i++) {
    if (!set.some((other, j) => j !== i && other.isrc === set[i]!.isrc)) continue;
    queries++;
    const scores = vs.map((v, j) => {
      if (j === i) return -Infinity;
      let dot = 0;
      for (let t = 0; t < v.length; t++) dot += v[t]! * vs[i]![t]!;
      return dot;
    });
    const ranked = scores.map((s, j) => [s, j] as const).sort((p, q) => q[0] - p[0]);
    const first = ranked.findIndex(([, j]) => set[j]!.isrc === set[i]!.isrc);
    if (first < 10) hits++;
    reciprocal += 1 / (first + 1);
  }
  return { queries, hitAt10: hits / queries, mrr: reciprocal / queries };
}

// 1. 評価
console.log(`学習：${train.length} 件、評価：${test.length} 件（曲単位で分けた）`);
const trial = fit(train.map((item) => item.x));
const results = {
  "2048 次元（そのまま）": evaluate(test, (x) => x),
  "pca（射影だけ）": evaluate(test, projectWith(trial.pca)),
  "white（白色化、収縮つき）": evaluate(test, projectWith(trial.white)),
};
console.table(results);

// 2. すべての感想で作り直して入れる。既にある行は置き換える。
const final = fit(items.map((item) => item.x));
const transforms = { "plamo-1b:pca256-v1": final.pca, "plamo-1b:white256-v1": final.white };
for (const [model, t] of Object.entries(transforms)) {
  await db
    .insert(embeddingTransforms)
    .values({ model, a: float32Bytes(t.a), b: float32Bytes(t.b) })
    .onConflictDoUpdate({
      target: embeddingTransforms.model,
      set: { a: float32Bytes(t.a), b: float32Bytes(t.b), createdAt: new Date() },
    });
}
console.log(
  JSON.stringify({
    reviews: items.length,
    train: train.length,
    test: test.length,
    explainedTrain: trial.explained,
    explainedAll: final.explained,
    results,
  }),
);
