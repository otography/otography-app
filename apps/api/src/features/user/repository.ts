import { and, eq, isNull, sql } from "drizzle-orm";
import {
  users,
  userProfiles,
  type InsertUserValues,
  type SetupProfileValues,
  type UpdateUserValues,
} from "../../shared/db/schema";
import type { DatabaseOrTransaction } from "../../shared/db";

// Firebase Auth と DB の同期は、限定的な SECURITY DEFINER 関数に閉じ込める。
export const insertUser = async (tx: DatabaseOrTransaction, values: InsertUserValues) => {
  return tx.execute<typeof users.$inferSelect>(sql`
    SELECT
      id,
      firebase_id AS "firebaseId",
      username,
      name,
      bio,
      birthplace,
      birthyear,
      gender,
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      deleted_at AS "deletedAt"
    FROM public.sync_firebase_user(${values.firebaseId})
  `);
};

// 現在のユーザーを取得（RLS で自分の行だけ取得）
export const selectCurrentUser = async (tx: DatabaseOrTransaction, userId: string) => {
  return tx
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
};

// username で公開プロフィールを取得（user_profiles ビュー経由で機密カラムを除外）
export const selectUserByUsername = async (tx: DatabaseOrTransaction, username: string) => {
  return tx.select().from(userProfiles).where(eq(userProfiles.username, username)).limit(1);
};

// 初回プロフィール設定 — UPDATE（レコードはサインアップ時に作成済み）
export const setupProfile = async (
  tx: DatabaseOrTransaction,
  userId: string,
  values: SetupProfileValues,
) => {
  return tx
    .update(users)
    .set({ ...values })
    .where(eq(users.id, userId))
    .returning();
};

// ユーザーのプロフィール詳細を更新（bio, birthplace, birthyear, gender, name）
export const updateUserDetails = async (
  tx: DatabaseOrTransaction,
  userId: string,
  values: UpdateUserValues,
) => {
  return tx
    .update(users)
    .set({ ...values })
    .where(eq(users.id, userId))
    .returning();
};

// ユーザーを論理削除
export const softDeleteUser = async (tx: DatabaseOrTransaction, userId: string) => {
  return tx
    .update(users)
    .set({ deletedAt: sql`now()` })
    .where(eq(users.id, userId))
    .returning();
};
