/**
 * 埋め込みの方式を、目的（曲をまたいで、同じ観点・同じ感性の感想を探す）に沿って評価する（MUS-78）。
 * GitHub Actions（.github/workflows/evaluate-embeddings.yml）から手動で実行する。
 *
 * 評価のデータ：packages/db/data/embedding-eval.json
 * - reviews：公式アカウントの感想 700 件（1 曲 1 件）。観点（aspect）と感性（mood）のラベル付き
 * - queries：短い言葉の検索 53 個。探したい観点・感性を持つ
 *
 * (a) 感想から探す：各感想を起点に、他の感想（すべて別の曲）を並べ、上位 10 件のうち、
 *     中心の観点が同じもの・中心の感性が同じものの割合（precision@10）
 * (b) 言葉で探す：各検索の文を Workers AI で埋め込み、上位 10 件のうち、探したい観点・感性を持つものの割合
 *
 * 比べる方式：2048 次元のまま、射影だけ（pca）、白色化（white）。変換は、評価の 700 件を除いた感想で作る。
 * 必要な環境変数：TURSO_DATABASE_URL、TURSO_AUTH_TOKEN、CLOUDFLARE_ACCOUNT_ID、WORKERS_AI_API_TOKEN、X_STORE_NAME
 */
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { posts, relations } from "db";
import { EMBEDDING_DIMENSIONS, EMBEDDING_INPUT_DIMENSIONS } from "db/constants";
import { OFFICIAL_USER_ID, officialPostId } from "db/official-reviews";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { restEmbedder, restVectorStore } from "./lib/cloudflare.ts";
import { fitTransforms, type Transform } from "./lib/pca.ts";

type EvalData = {
  reviews: {
    key: string;
    aspectPrimary: string;
    aspects: string[];
    moodPrimary: string;
    moods: string[];
  }[];
  queries: { text: string; aspect: string | null; mood: string | null }[];
};

const D = EMBEDDING_INPUT_DIMENSIONS;
const K = EMBEDDING_DIMENSIONS;
const TOP = 10;

function fail(error: Error): never {
  console.error(error);
  process.exit(1);
}

const data = JSON.parse(
  await readFile(
    new URL("../../../packages/db/data/embedding-eval.json", import.meta.url).pathname,
    "utf8",
  ),
) as EvalData;

const db = drizzle({
  client: createClient({
    url: process.env.TURSO_DATABASE_URL || "http://127.0.0.1:8080",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  }),
  relations,
});
const store = await restVectorStore(process.env.X_STORE_NAME ?? "x-store-staging-01");
if (store instanceof Error) fail(store);

const allIds = (
  await db.select({ id: posts.id }).from(posts).where(eq(posts.userId, OFFICIAL_USER_ID))
).map((row) => row.id);
const xs = await store.get(allIds);
if (xs instanceof Error) fail(xs);

const labeled = data.reviews.flatMap((review) => {
  const x = xs.get(officialPostId(review.key));
  return x ? [{ ...review, x }] : [];
});
const evalIds = new Set(data.reviews.map((review) => officialPostId(review.key)));
const fitRows = allIds.filter((id) => !evalIds.has(id)).flatMap((id) => xs.get(id) ?? []);
console.log(
  `評価：${labeled.length} 件、変換の学習：${fitRows.length} 件、検索の文：${data.queries.length} 個`,
);

const queryX = await restEmbedder(data.queries.map((q) => q.text));
if (queryX instanceof Error) fail(queryX);
const queryVectors: Float32Array[] = queryX;

const fitted = fitTransforms(fitRows, D, K);
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
const dot = (a: Float64Array, b: Float64Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
};

/** 起点のベクトルから、評価の感想を上位 TOP 件だけ返す（exclude は除く）。 */
const topOf = (vs: Float64Array[], q: Float64Array, exclude: number) =>
  vs
    .map((v, j) => [j === exclude ? -Infinity : dot(v, q), j] as const)
    .sort((p, q2) => q2[0] - p[0])
    .slice(0, TOP)
    .map(([, j]) => labeled[j]!);

function evaluate(vectorOf: (x: Float32Array) => ArrayLike<number>) {
  const vs = labeled.map((item) => normalize(vectorOf(item.x)));
  let sameAspect = 0;
  let sameMood = 0;
  for (let i = 0; i < labeled.length; i++) {
    const top = topOf(vs, vs[i]!, i);
    sameAspect += top.filter((r) => r.aspectPrimary === labeled[i]!.aspectPrimary).length / TOP;
    sameMood += top.filter((r) => r.moodPrimary === labeled[i]!.moodPrimary).length / TOP;
  }
  let textHits = 0;
  for (const [qi, query] of data.queries.entries()) {
    const top = topOf(vs, normalize(vectorOf(queryVectors[qi]!)), -1);
    textHits +=
      top.filter(
        (r) =>
          (!query.aspect || r.aspects.includes(query.aspect)) &&
          (!query.mood || r.moods.includes(query.mood)),
      ).length / TOP;
  }
  return {
    "(a) 観点が同じ": sameAspect / labeled.length,
    "(a) 感性が同じ": sameMood / labeled.length,
    "(b) 言葉で探す": textHits / data.queries.length,
  };
}

// 偶然の一致：ランダムに 10 件選んだときに当たる割合
const share = (pick: (r: (typeof labeled)[number]) => string) => {
  const counts = new Map<string, number>();
  for (const r of labeled) counts.set(pick(r), (counts.get(pick(r)) ?? 0) + 1);
  return [...counts.values()].reduce(
    (s, c) => s + (c / labeled.length) * ((c - 1) / (labeled.length - 1)),
    0,
  );
};
const textBase =
  data.queries.reduce(
    (s, q) =>
      s +
      labeled.filter(
        (r) => (!q.aspect || r.aspects.includes(q.aspect)) && (!q.mood || r.moods.includes(q.mood)),
      ).length /
        labeled.length,
    0,
  ) / data.queries.length;

const results = {
  "偶然（ランダム）": {
    "(a) 観点が同じ": share((r) => r.aspectPrimary),
    "(a) 感性が同じ": share((r) => r.moodPrimary),
    "(b) 言葉で探す": textBase,
  },
  "2048 次元（そのまま）": evaluate((x) => x),
  "pca（射影だけ）": evaluate(projectWith(fitted.pca)),
  "white（白色化、収縮つき）": evaluate(projectWith(fitted.white)),
};
console.table(results);
console.log(JSON.stringify(results));
