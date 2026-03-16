/**
 * Database Connection
 *
 * Drizzle ORM で Supabase (PostgreSQL) に接続するクライアント。
 *
 * ## 使い方
 *
 * ```ts
 * import { db } from "./db";
 * import { users } from "./db/schema";
 * import { eq } from "drizzle-orm";
 *
 * // SELECT
 * const allUsers = await db.select().from(users);
 *
 * // INSERT
 * await db.insert(users).values({ name: "John", email: "john@example.com" });
 *
 * // UPDATE
 * await db.update(users).set({ name: "Jane" }).where(eq(users.id, 1));
 *
 * // DELETE
 * await db.delete(users).where(eq(users.id, 1));
 * ```
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
