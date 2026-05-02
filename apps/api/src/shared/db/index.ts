/**
 * Database Connection
 *
 * Drizzle ORM で PostgreSQL に接続するクライアント。
 *
 * Cloudflare Workers ではリクエスト境界ごとに I/O コンテキストが異なるため、
 * コネクションをシングルトンにせずリクエストごとに作成する。
 */

import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const createDb = () => {
  const client = postgres(env.DATABASE_URL, { prepare: false });

  return drizzle({ client, jit: true });
};

export type Database = ReturnType<typeof createDb>;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DatabaseOrTransaction = Database | DatabaseTransaction;
