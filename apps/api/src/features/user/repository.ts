import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { and, eq, isNull, sql } from "drizzle-orm";
import { DbError } from "@repo/errors";
import { users, type SetupProfileValues, type UpdateUserValues } from "../../shared/db/schema";
import { withRls } from "../../shared/db/rls";
import { createDb } from "../../shared/db";

// 現在のユーザーを取得（論理削除済みは除外、公開 SELECT のため withRls 不要）
export const selectCurrentUser = async (claims: DecodedIdToken) => {
  const db = createDb();
  return db
    .select()
    .from(users)
    .where(and(eq(users.firebaseId, claims.sub), isNull(users.deletedAt)))
    .limit(1);
};

// username でユーザーを取得（論理削除済みは除外、公開プロフィール用）
// 公開プロフィールに必要なカラムのみ取得（firebaseId などの機密情報を含めない）
export const selectUserByUsername = async (username: string) => {
  const db = createDb();
  return db
    .select({
      username: users.username,
      name: users.name,
      bio: users.bio,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt)))
    .limit(1);
};

// ユーザーを新規作成（username, name）— withRls を使わず createDb() を直接使用
export const insertUserProfile = async (claims: DecodedIdToken, values: SetupProfileValues) => {
  if (typeof claims.sub !== "string") {
    return new DbError({ message: "Missing user identifier in session." });
  }

  const db = createDb();
  return db
    .insert(users)
    .values({ firebaseId: claims.sub, ...values })
    .onConflictDoUpdate({
      target: users.firebaseId,
      set: { ...values, deletedAt: null, updatedAt: sql`now()` },
    })
    .returning()
    .catch(
      (e) => new DbError({ message: "Failed to insert user profile.", statusCode: 500, cause: e }),
    );
};

// ユーザーのプロフィール詳細を更新（bio, birthplace, birthyear, gender, name）
export const updateUserDetails = async (claims: DecodedIdToken, values: UpdateUserValues) => {
  return withRls(claims, async (tx, userId) =>
    tx
      .update(users)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(users.id, userId))
      .returning(),
  );
};

// ユーザーを論理削除
export const softDeleteUser = async (claims: DecodedIdToken) => {
  return withRls(claims, async (tx, userId) =>
    tx
      .update(users)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(users.id, userId))
      .returning(),
  );
};
