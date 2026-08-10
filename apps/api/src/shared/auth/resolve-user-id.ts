import { sql } from "drizzle-orm";
import { DbError } from "@repo/errors";
import type { DatabaseOrTransaction } from "../db";
import { toDbError } from "../db/postgres-error";

// Firebase ID → UUID 解決
export const resolveUserId = async (
  db: DatabaseOrTransaction,
  firebaseId: string,
): Promise<string | DbError> => {
  const rows = await db
    .execute<{ resolve_firebase_id: string | null }>(sql`select resolve_firebase_id(${firebaseId})`)
    .catch((e) => toDbError(e, "Failed to resolve user ID."));

  if (rows instanceof Error) return rows;
  const userId = rows[0]?.resolve_firebase_id;
  if (!userId) {
    return new DbError({ message: "User not found in database." });
  }

  return userId;
};
