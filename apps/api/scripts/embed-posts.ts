/**
 * 埋め込みの無い投稿の埋め込みを作る。GitHub Actions（.github/workflows/embed-posts.yml）から実行する。
 *
 * 1. 他人に見せてよい投稿のうち、D1 に x が無いものを Workers AI で埋め込み、D1 に入れる（1 回に MAX_POSTS 件まで）
 * 2. 変換 A があれば、post_embeddings に z が無い投稿について、D1 の x から z を作って Turso に入れる
 *
 * 投稿時の Worker が埋め込みを作れなかった投稿と、変換を作る前の投稿を補う。何度実行しても二重には入らない。
 * 必要な環境変数：TURSO_DATABASE_URL、TURSO_AUTH_TOKEN、CLOUDFLARE_ACCOUNT_ID、WORKERS_AI_API_TOKEN、X_STORE_NAME
 */
import { createClient } from "@libsql/client";
import { postEmbeddings, posts, relations, users } from "db";
import { EMBEDDING_MODEL } from "db/constants";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { loadTransform } from "../src/embeddings/transform.ts";
import { embedPosts, saveProjected } from "../src/embeddings/usecases/embed-posts.ts";
import { restEmbedder, restVectorStore } from "./lib/cloudflare.ts";

/** 1 回に埋め込む投稿の上限。Workers AI の無料枠のうち、バッチに使う分（1 日 4,000 Neurons）に収める。 */
const MAX_POSTS = Number(process.env.MAX_POSTS ?? 20_000);
const CHUNK = 200;

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

const store = await restVectorStore(process.env.X_STORE_NAME ?? "x-store-staging-01");
if (store instanceof Error) {
  fail(store);
}

// 他人に見せてよい投稿（削除・非表示でなく、投稿者が利用停止中・退会済みでない）。
const visible = await db
  .select({ id: posts.id, content: posts.content })
  .from(posts)
  .innerJoin(users, eq(users.id, posts.userId))
  .where(
    and(
      isNull(posts.deletedAt),
      isNull(posts.hiddenAt),
      isNull(users.suspendedAt),
      isNull(users.deletedAt),
    ),
  );

const stored = await store.listIds();
if (stored instanceof Error) {
  fail(stored);
}

const missing = visible.filter((post) => !stored.has(post.id)).slice(0, MAX_POSTS);
const transform = await loadTransform({ db, model: EMBEDDING_MODEL });
if (transform instanceof Error) {
  fail(transform);
}

let embedded = 0;
let projected = 0;
for (let i = 0; i < missing.length; i += CHUNK) {
  const result = await embedPosts({
    db,
    embed: restEmbedder,
    store,
    transform,
    posts: missing.slice(i, i + CHUNK),
  });
  if (result instanceof Error) {
    fail(result);
  }
  embedded += result.stored;
  projected += result.projected;
  console.log(`埋め込みを作りました：${embedded} / ${missing.length}`);
}

// x はあるが z が無い投稿（変換を作る前に埋め込んだ投稿）に、z を作る。
if (transform) {
  const withZ = new Set(
    (
      await db
        .select({ postId: postEmbeddings.postId })
        .from(postEmbeddings)
        .where(eq(postEmbeddings.model, transform.model))
    ).map((row) => row.postId),
  );
  const pending = visible.filter((post) => !withZ.has(post.id)).map((post) => post.id);
  for (let i = 0; i < pending.length; i += CHUNK) {
    const xs = await store.get(pending.slice(i, i + CHUNK));
    if (xs instanceof Error) {
      fail(xs);
    }
    const saved = await saveProjected({
      db,
      transform,
      rows: [...xs].map(([postId, x]) => ({ postId, x })),
    });
    if (saved instanceof Error) {
      fail(saved);
    }
    projected += saved;
  }
}

console.log(
  JSON.stringify({
    visible: visible.length,
    alreadyStored: stored.size,
    embedded,
    projected,
    transform: transform ? transform.model : null,
  }),
);
