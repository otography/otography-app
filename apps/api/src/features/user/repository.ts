import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { and, eq, isNull, sql } from "drizzle-orm";
import { DbError } from "@repo/errors";
import {
  users,
  userProfiles,
  type SetupProfileValues,
  type UpdateUserValues,
} from "../../shared/db/schema";
import { withRls } from "../../shared/db/rls";
import { createDb } from "../../shared/db";

// 現在のユーザーを取得（withRls で自分の行だけ取得、RLS で防御）
export const selectCurrentUser = async (claims: DecodedIdToken) => {
  return withRls(claims, async (tx, userId) =>
    tx
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1),
  );
};

// username で公開プロフィールを取得（user_profiles ビュー経由で機密カラムを除外）
export const selectUserByUsername = async (username: string) => {
  const db = createDb();
  return db.select().from(userProfiles).where(eq(userProfiles.username, username)).limit(1);
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
