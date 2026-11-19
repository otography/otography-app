/**
 * 埋め込みの統計を取り込み、必要なら計量を作り直す（apps/api/src/embeddings/usecases/refresh-metric.ts）。
 * GitHub Actions（.github/workflows/embedding-metric.yml）から実行する。
 *
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... vp run api#embedding:refresh
 *
 * TURSO_DATABASE_URL が無ければ、ローカルの turso dev（http://127.0.0.1:8080）を使う。
 */
import { createClient } from "@libsql/client";
import { relations } from "db";
import { drizzle } from "drizzle-orm/libsql";
import { refreshEmbeddingMetric } from "../src/embeddings/usecases/refresh-metric.ts";

const db = drizzle({
  client: createClient({
    url: process.env.TURSO_DATABASE_URL || "http://127.0.0.1:8080",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  }),
  relations,
});

// 検索の補正を始めるのは、EMBEDDING_METRIC_PUBLISH=true のときだけ（usecases/refresh-metric.ts の publish）。
const result = await refreshEmbeddingMetric({
  db,
  now: new Date(),
  publish: process.env.EMBEDDING_METRIC_PUBLISH === "true",
});
if (result instanceof Error) {
  console.error(result);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result));
}
