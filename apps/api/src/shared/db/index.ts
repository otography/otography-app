/**
 * Database Connection
 *
 * Drizzle ORM で PostgreSQL に接続するクライアント。
 *
 * ## 使い方
 *
 * ```ts
 * import { db } from "@/shared/db";
 * import { users } from "@/shared/db/schema";
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
import type { Context } from "hono";
import postgres from "postgres";
import { getEnv } from "../../env";
import { users } from "./schema";

const createDb = (connectionString: string) => {
	// Disable prepared statements (prepare: false) as they are not supported for "Transaction" pool mode
	const client = postgres(connectionString, { prepare: false });

	return drizzle({
		client,
		schema: {
			users,
		},
	});
};

type Database = ReturnType<typeof createDb>;

declare global {
	var __otography_db__: Database | undefined;
}

export const getDb = (c: Context) => {
	if (globalThis.__otography_db__) {
		return globalThis.__otography_db__;
	}

	const env = getEnv(c);
	const db = createDb(env.DATABASE_URL);
	globalThis.__otography_db__ = db;
	return db;
};
