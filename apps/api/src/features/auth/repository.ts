import { sql } from "drizzle-orm";
import { users } from "../../shared/db/schema";
import { type DatabaseTransaction } from "../../shared/db";

// firebaseId でユーザーを登録（重複時は無視）
export const insertUser = async (
  tx: DatabaseTransaction,
  values: { firebaseId: string; username: string },
) => {
  return tx.insert(users).values(values).onConflictDoNothing({
    target: users.firebaseId,
  });
};

// firebaseId でユーザーを upsert（重複時は updatedAt を更新して返す）
export const upsertUser = async (
  tx: DatabaseTransaction,
  values: { firebaseId: string; username: string },
) => {
  return tx
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.firebaseId,
      set: {
        updatedAt: sql`now()`,
      },
    })
    .returning();
};
