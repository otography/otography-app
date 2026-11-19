import { postEmbeddings, posts, users } from "db";
import { sql } from "drizzle-orm";
import type { Database } from "../lib/db.ts";
import { EmbeddingSearchError } from "./errors.ts";
import { type Metric, toQuery } from "./metric.ts";

const vector16 = (v: ArrayLike<number>) => sql`vector16(${JSON.stringify(Array.from(v))})`;

/**
 * z に近い投稿を、計量 metric でのコサインが大きい順に返す。他人に見せてよい投稿だけを返す。
 *
 * vector_top_k で候補を candidates 件取り、同じ SQL の中で次のスコアで並べ直す
 * （docs/adr/0019-embedding-search-in-raw-sql.md）。
 *
 *   score = ⟨z_i − m, u⟩ / ‖z_i − m‖_P,  u = P(z − m)
 *   ⟨z_i − m, u⟩ = (1 − vector_distance_cos(z_i, u)) · ‖z_i‖ · ‖u‖ − ⟨m, u⟩
 *
 * ‖z_i‖ は post_embeddings.norm、‖z_i − m‖_P は metric の pnorm 列から読む。
 * metric が null（統計の補正なし）なら、z と z_i のコサインで並べる。
 */
export async function searchSimilarPosts({
  db,
  z,
  metric,
  limit,
  candidates,
}: {
  db: Database;
  z: ArrayLike<number>;
  metric: Metric | null;
  limit: number;
  candidates: number;
}) {
  const query = metric ? toQuery(z, metric) : null;
  // u が 0（z が平均と一致する）ときは、どの投稿ともコサインが決まらない
  if (query && query.uNorm === 0) return [];

  const target = vector16(query ? query.u : z);
  const score =
    metric && query
      ? sql<number>`((1 - vector_distance_cos(${postEmbeddings.embedding}, ${target}))
            * ${postEmbeddings.norm} * ${query.uNorm} - ${query.meanDotU})
          / coalesce(
              ${metric.pnormColumn === "pnormA" ? postEmbeddings.pnormA : postEmbeddings.pnormB},
              vector_distance_l2(${postEmbeddings.embedding}, ${vector16(metric.mean)}) * ${query.isotropicScale}
            )`
      : sql<number>`1 - vector_distance_cos(${postEmbeddings.embedding}, ${target})`;

  // vector_top_k は表を返す関数で、Drizzle のビルダーでは書けないので、SQL をそのまま書く。
  // 返る id は post_embeddings の rowid（packages/db/src/schema/posts.ts）。
  return db
    .all<{ postId: string; score: number }>(
      sql`select ${posts.id} as postId, ${score} as score
        from vector_top_k('post_embeddings_vector_idx', ${target}, ${candidates}) as candidates
        join ${postEmbeddings} on ${postEmbeddings}.rowid = candidates.id
        join ${posts} on ${posts.id} = ${postEmbeddings.postId}
        join ${users} on ${users.id} = ${posts.userId}
        where ${posts.deletedAt} is null and ${posts.hiddenAt} is null
          and ${users.suspendedAt} is null and ${users.deletedAt} is null
        order by score desc
        limit ${limit}`,
    )
    .catch((e) => new EmbeddingSearchError({ cause: e }));
}
