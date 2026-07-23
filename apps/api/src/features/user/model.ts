import { type } from "arktype";
import { createInsertSchema, createUpdateSchema } from "drizzle-orm/arktype";
import { users } from "../../shared/db/schema";

const insertUserSchema = createInsertSchema(users);

// DB管理列と認証IDはプロフィール更新の対象外
export const updateUserSchema = createUpdateSchema(users).omit(
  "id",
  "firebaseId",
  "createdAt",
  "updatedAt",
  "deletedAt",
);

// 初回プロフィール設定では username と name を必須にする
export const setupProfileSchema = type.merge(updateUserSchema.pick("username", "name").required(), {
  username: type.pipe(type("string.trim"), type("string >= 1")),
  name: type.pipe(type("string.trim"), type("string >= 1")),
});

export type InsertUserValues = typeof insertUserSchema.infer;
export type UpdateUserValues = typeof updateUserSchema.infer;
export type SetupProfileValues = typeof setupProfileSchema.infer;
