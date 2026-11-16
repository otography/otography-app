import { createClient } from "@libsql/client/web";
import { relations } from "db";
import { drizzle } from "drizzle-orm/libsql/web";
import { requireEnv } from "./env.ts";

// Workers はリクエストをまたいだ接続を持てないので、HTTP で問い合わせる web 版のクライアントを使う。
// モジュールの最上位で 1 回だけ作り、同じ isolate のリクエストで使い回す。
export const db = drizzle({
  client: createClient({
    url: requireEnv("TURSO_DATABASE_URL"),
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  }),
  relations,
});

export type Database = typeof db;
