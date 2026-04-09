import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { sql } from "drizzle-orm";
import { users } from "../../shared/db/schema";
import { type DatabaseTransaction } from "../../shared/db";
import { withRls } from "../../shared/db/rls";

// firebaseId でユーザーを登録（重複時は無視）
export const insertUser = async (
  tx: DatabaseTransaction,
  values: { firebaseId: string; username: string },
) => {
  return tx.insert(users).values(values).onConflictDoNothing({
    target: users.firebaseId,
  });
};

// RLS 付きでユーザーを登録（重複時は無視）
const insertUserWithRls = async (
  claims: DecodedIdToken,
  values: { firebaseId: string; username: string },
) => {
  return withRls(claims, async (tx) => insertUser(tx, values));
};

// firebaseId でユーザーを upsert（重複時は updatedAt を更新して返す）
const upsertUser = async (
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

// RLS 付きでユーザーを upsert（重複時は updatedAt を更新して返す）
export const upsertUserWithRls = async (
  claims: DecodedIdToken,
  values: { firebaseId: string; username: string },
) => {
  return withRls(claims, async (tx) => upsertUser(tx, values));
};
