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

export const createDbClient = () => {
  const client = postgres(env.DATABASE_URL, {
    prepare: false,
    max: 5,
    connect_timeout: 10,
  });

  return {
    db: drizzle({ client, jit: false }),
    end: () => client.end({ timeout: 5 }),
  };
};

export type DatabaseClient = ReturnType<typeof createDbClient>;
export type Database = DatabaseClient["db"];
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DatabaseOrTransaction = Database | DatabaseTransaction;
