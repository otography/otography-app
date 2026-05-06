import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { PgAsyncSelect } from "drizzle-orm/pg-core/async/select";
import type { InternalCursor } from "./types";

/**
 * cursor-based pagination の WHERE 条件を生成する。
 *
 * `(createdAt, id) < (cursor.createdAt, cursor.id)` を
 * 行タプル比較で表現し、Postgres が複合インデックスを
 * 効率よく使用できるようにする。
 *
 * ソート順: created_at DESC, id DESC
 * → カーソル条件: (created_at, id) < (cursor.createdAt, cursor.id)
 */
export const cursorWhereClause = (
  createdAtCol: PgColumn,
  idCol: PgColumn,
  cursor: InternalCursor,
) => {
  const createdAt =
    typeof cursor.createdAt === "string" ? cursor.createdAt : cursor.createdAt.toISOString();

  return sql`(${createdAtCol}, ${idCol}) < (${createdAt}::timestamptz, ${cursor.id})`;
};

/**
 * ページネーションクエリに LIMIT を適用する。
 *
 * Drizzle の `$dynamic()` を活用し、任意の SELECT クエリビルダに
 * LIMIT を後付けできるようにする。呼び出し側は事前に `$dynamic()` を
 * 呼び出したクエリを渡す必要がある。
 *
 * LIMIT は `requestedLimit + 1` を指定し、
 * 取得結果から hasNext を判定する（Supabase推奨パターン）。
 */
export const withPagination = <T extends PgAsyncSelect>(
  qb: T,
  pagination?: { limit?: number; cursor?: InternalCursor | null },
) => {
  if (pagination?.limit !== undefined) {
    return qb.limit(pagination.limit + 1);
  }

  return qb;
};
