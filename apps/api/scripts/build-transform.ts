/**
 * 変換 z = Ax + b（2048 → 256 次元）を作り、効果を評価して、Turso の embedding_transforms に入れる（MUS-78）。
 * GitHub Actions（.github/workflows/build-transform.yml）から実行する。
 *
 * 1. 日本語版ウィキペディアの記事の冒頭から、文を CORPUS_SIZE 件集め、Workers AI で埋め込む
 * 2. その x で PCA を行い、2 つの変換を作る
 *    - plamo-1b:pca256-v1：上位 256 方向に射影するだけ（A = Uᵀ）
 *    - plamo-1b:white256-v1：射影して、方向ごとの分散を 1 にそろえる（A = Λ^(-1/2) Uᵀ、白色化）
 * 3. 公式アカウントの感想（D1 にある x）で評価する。同じ曲の別の感想が、コサインで上位 10 件に入るか
 *    （hit@10）と、最初に出る順位の逆数の平均（MRR）を、2048 次元のまま、2 つの変換で比べる
 * 4. 2 つの変換を両方とも Turso に入れる。どちらを使うかは、評価を見て db/constants の EMBEDDING_MODEL で選ぶ
 *
 * 評価に使う感想は、変換を作る文に含めない（含めると評価が実際より良く出る）。
 * 必要な環境変数：TURSO_DATABASE_URL、TURSO_AUTH_TOKEN、CLOUDFLARE_ACCOUNT_ID、WORKERS_AI_API_TOKEN、X_STORE_NAME
 */
import { createClient } from "@libsql/client";
import { embeddingTransforms, posts, relations } from "db";
import { EMBEDDING_DIMENSIONS, EMBEDDING_INPUT_DIMENSIONS } from "db/constants";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { float32Bytes } from "../src/embeddings/vectors.ts";
import { restEmbedder, restVectorStore } from "./lib/cloudflare.ts";
import { covariance, topEigen } from "./lib/pca.ts";

const CORPUS_SIZE = Number(process.env.CORPUS_SIZE ?? 20_000);
const OFFICIAL_USER_ID = "official-otography";
const D = EMBEDDING_INPUT_DIMENSIONS;
const K = EMBEDDING_DIMENSIONS;

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

// 1. コーパス：ランダムな記事の冒頭を、句点で文に分ける。投稿の上限（140 字）程度の長さの文だけを使う。
async function collectCorpus(size: number) {
  const sentences = new Set<string>();
  while (sentences.size < size) {
    const url =
      "https://ja.wikipedia.org/w/api.php?action=query&generator=random&grnnamespace=0&grnlimit=20" +
      "&prop=extracts&exintro=1&explaintext=1&exlimit=20&format=json&formatversion=2";
    const res = await fetch(url, { headers: { "User-Agent": "embedding-corpus-builder/1.0" } });
    if (!res.ok) fail(new Error(`ウィキペディアから記事を取れませんでした（HTTP ${res.status}）`));
    const body = (await res.json()) as { query?: { pages?: { extract?: string }[] } };
    for (const page of body.query?.pages ?? []) {
      for (const raw of (page.extract ?? "").split(/(?<=。)/)) {
        const sentence = raw.replace(/\s+/g, " ").trim();
        const length = Array.from(sentence).length;
        if (length >= 20 && length <= 140) sentences.add(sentence);
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return [...sentences].slice(0, size);
}

const corpus = await collectCorpus(CORPUS_SIZE);
console.log(`コーパス：${corpus.length} 文`);
const corpusX = await restEmbedder(corpus);
if (corpusX instanceof Error) fail(corpusX);
console.log("コーパスを埋め込みました");

// 2. PCA と 2 つの変換
const { mean, c } = covariance(corpusX, D);
const { values, vectors } = topEigen(c, D, K);
const explained =
  values.reduce((s, v) => s + v, 0) /
  Array.from({ length: D }, (_, i) => c[i * D + i]!).reduce((s, v) => s + v, 0);
console.log(`上位 ${K} 方向で説明できる分散の割合：${(explained * 100).toFixed(1)}%`);

const buildTransform = (whiten: boolean) => {
  const a = new Float32Array(K * D);
  const b = new Float32Array(K);
  for (let r = 0; r < K; r++) {
    const scale = whiten ? 1 / Math.sqrt(values[r]!) : 1;
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
const transforms = {
  "plamo-1b:pca256-v1": buildTransform(false),
  "plamo-1b:white256-v1": buildTransform(true),
};

// 3. 評価：公式アカウントの感想（曲ごとに最大 5 件）
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
console.log(`評価に使う感想：${items.length} 件（D1 に x がある分）`);

const normalize = (v: ArrayLike<number>) => {
  const out = Float64Array.from(v);
  const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0)) || 1;
  return out.map((x) => x / norm);
};
const evaluate = (vectorsOf: (x: Float32Array) => ArrayLike<number>) => {
  const vs = items.map((item) => normalize(vectorsOf(item.x)));
  let hits = 0;
  let reciprocal = 0;
  let queries = 0;
  for (let i = 0; i < items.length; i++) {
    if (!items.some((other, j) => j !== i && other.isrc === items[i]!.isrc)) continue;
    queries++;
    const scores = vs.map((v, j) => {
      if (j === i) return -Infinity;
      let dot = 0;
      for (let t = 0; t < v.length; t++) dot += v[t]! * vs[i]![t]!;
      return dot;
    });
    const ranked = scores.map((s, j) => [s, j] as const).sort((p, q) => q[0] - p[0]);
    const first = ranked.findIndex(([, j]) => items[j]!.isrc === items[i]!.isrc);
    if (first < 10) hits++;
    reciprocal += 1 / (first + 1);
  }
  return { queries, hitAt10: hits / queries, mrr: reciprocal / queries };
};
const projectWith = (t: { a: Float32Array; b: Float32Array }) => (x: Float32Array) => {
  const z = new Float64Array(K);
  for (let r = 0; r < K; r++) {
    let acc = t.b[r]!;
    for (let j = 0; j < D; j++) acc += t.a[r * D + j]! * x[j]!;
    z[r] = acc;
  }
  return z;
};
const results = {
  "2048 次元（そのまま）": evaluate((x) => x),
  "plamo-1b:pca256-v1": evaluate(projectWith(transforms["plamo-1b:pca256-v1"])),
  "plamo-1b:white256-v1": evaluate(projectWith(transforms["plamo-1b:white256-v1"])),
};
console.table(results);

// 4. 両方の変換を入れる。既にある行は置き換える（作り直したときのため）。
for (const [model, t] of Object.entries(transforms)) {
  await db
    .insert(embeddingTransforms)
    .values({ model, a: float32Bytes(t.a), b: float32Bytes(t.b) })
    .onConflictDoUpdate({
      target: embeddingTransforms.model,
      set: { a: float32Bytes(t.a), b: float32Bytes(t.b), createdAt: new Date() },
    });
}
console.log(JSON.stringify({ corpus: corpus.length, explained, results }));
