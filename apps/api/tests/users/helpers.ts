import { users } from "db";
import type { Database } from "../../src/lib/db.ts";

/** テスト用のユーザーを作る。 */
export const insertUser = (db: Database, overrides: Partial<typeof users.$inferInsert> = {}) =>
  db.insert(users).values({
    id: "u1",
    name: "テスト",
    email: "a@example.com",
    publicId: "abc123def456",
    ...overrides,
  });
