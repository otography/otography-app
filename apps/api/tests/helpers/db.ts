import { createClient } from "@libsql/client";
import { relations } from "db";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Database } from "../../src/lib/db.ts";

/** マイグレーションを適用したインメモリの DB を作る。 */
export async function createTestDb(): Promise<Database> {
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = ON");
  const db = drizzle({ client, relations });
  await migrate(db, {
    migrationsFolder: new URL("../../../../packages/db/migrations", import.meta.url).pathname,
  });
  // 本番は web 版のクライアント（drizzle-orm/libsql/web）だが、型は同じなので、そのまま Database として返せる。
  return db;
}
