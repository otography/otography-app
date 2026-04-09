import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { and, eq, isNull, sql } from "drizzle-orm";
import { users, type SetupProfileValues, type UpdateUserValues } from "../../shared/db/schema";
import { withRls } from "../../shared/db/rls";
import { createDb } from "../../shared/db";

// firebaseId でユーザーを取得（論理削除済みは除外、RLS 適用）
export const selectUserByFirebaseId = async (claims: DecodedIdToken) => {
  return withRls(claims, async (tx) =>
    tx
      .select()
      .from(users)
      .where(and(eq(users.firebaseId, claims.sub), isNull(users.deletedAt)))
      .limit(1),
  );
};

// username でユーザーを取得（論理削除済みは除外、公開プロフィール用）
export const selectUserByUsername = async (username: string) => {
  const db = createDb();
  return db
    .select()
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt)))
    .limit(1);
};

// ユーザーを新規作成（username, name）
export const insertUserProfile = async (claims: DecodedIdToken, values: SetupProfileValues) => {
  return withRls(claims, async (tx) =>
    tx
      .insert(users)
      .values({ firebaseId: claims.sub, ...values })
      .onConflictDoUpdate({
        target: users.firebaseId,
        set: { ...values, deletedAt: null, updatedAt: sql`now()` },
      })
      .returning(),
  );
};

// ユーザーのプロフィール詳細を更新（bio, birthplace, birthyear, gender, name）
export const updateUserDetails = async (claims: DecodedIdToken, values: UpdateUserValues) => {
  return withRls(claims, async (tx) =>
    tx
      .update(users)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(users.firebaseId, claims.sub))
      .returning(),
  );
};

// ユーザーを論理削除
export const softDeleteUser = async (claims: DecodedIdToken) => {
  return withRls(claims, async (tx) =>
    tx
      .update(users)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(users.firebaseId, claims.sub))
      .returning(),
  );
};
