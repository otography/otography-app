/**
 * 本文を直した投稿の埋め込みを作り直す。GitHub Actions（.github/workflows/reembed-posts.yml）から手動で実行する。
 *
 * D1 の x と post_embeddings の z は、どちらも「既にある行はそのままにする」書き方なので、
 * 本文を直しても古い埋め込みが残る。指定した投稿の x と z を消してから、今の本文で作り直す。
 * z の削除と追加は、post_embeddings のトリガーが統計の差分ログに書く。
 *
 * 必要な環境変数：POST_IDS（投稿の ID をカンマで区切ったもの）、TURSO_DATABASE_URL、TURSO_AUTH_TOKEN、
 * CLOUDFLARE_ACCOUNT_ID、WORKERS_AI_API_TOKEN、X_STORE_NAME
 */
import { createClient } from "@libsql/client";
import { postEmbeddings, posts, relations } from "db";
import { EMBEDDING_MODEL } from "db/constants";
import { and, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { loadTransform } from "../src/embeddings/transform.ts";
import { embedPosts } from "../src/embeddings/usecases/embed-posts.ts";
import { restEmbedder, restVectorStore } from "./lib/cloudflare.ts";

const CHUNK = 100;

function fail(error: Error): never {
  console.error(error);
  process.exit(1);
}

const ids = [
  ...new Set(
    (process.env.POST_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  ),
];
if (ids.length === 0) {
  fail(new Error("POST_IDS に投稿の ID を入れてください"));
}

const db = drizzle({
  client: createClient({
    url: process.env.TURSO_DATABASE_URL || "http://127.0.0.1:8080",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  }),
  relations,
});

const transform = await loadTransform({ db, model: EMBEDDING_MODEL });
if (transform instanceof Error) {
  fail(transform);
}
if (!transform) {
  fail(
    new Error(
      `変換 ${EMBEDDING_MODEL} がありません。先に Build embedding transform を実行してください`,
    ),
  );
}

const store = await restVectorStore(process.env.X_STORE_NAME ?? "x-store-staging-01");
if (store instanceof Error) {
  fail(store);
}

let reembedded = 0;
for (let i = 0; i < ids.length; i += CHUNK) {
  const part = ids.slice(i, i + CHUNK);
  const targets = await db
    .select({ id: posts.id, content: posts.content })
    .from(posts)
    .where(and(inArray(posts.id, part), isNull(posts.deletedAt)));
  const targetIds = targets.map((post) => post.id);
  if (targetIds.length === 0) {
    continue;
  }

  await db.delete(postEmbeddings).where(inArray(postEmbeddings.postId, targetIds));
  const removed = await store.remove(targetIds);
  if (removed instanceof Error) {
    fail(removed);
  }

  const result = await embedPosts({ db, embed: restEmbedder, store, transform, posts: targets });
  if (result instanceof Error) {
    fail(result);
  }
  reembedded += result.projected;
  console.log(`埋め込みを作り直しました：${reembedded} / ${ids.length}`);
}

console.log(JSON.stringify({ requested: ids.length, reembedded, transform: transform.model }));
