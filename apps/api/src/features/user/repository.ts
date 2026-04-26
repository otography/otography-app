import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  users,
  userProfiles,
  type InsertUserValues,
  type SetupProfileValues,
  type UpdateUserValues,
} from "../../shared/db/schema";
import { withRls } from "../../shared/db/rls";
import { createDb } from "../../shared/db";

// サインアップ時にユーザーレコードを作成（RLS 不要、まだセッションがないため）
export const insertUser = async (values: InsertUserValues) => {
  const db = createDb();
  return db.insert(users).values(values).returning();
};

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

// 初回プロフィール設定 — withRls 経由で UPDATE（レコードはサインアップ時に作成済み）
export const setupProfile = async (claims: DecodedIdToken, values: SetupProfileValues) => {
  return withRls(claims, async (tx, userId) =>
    tx
      .update(users)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(users.id, userId))
      .returning(),
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
