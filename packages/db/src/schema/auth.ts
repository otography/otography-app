import { sql } from "drizzle-orm";
import { check, index, integer, snakeCase, text } from "drizzle-orm/sqlite-core";
import { USER_BIO_MAX, USER_NAME_MAX } from "../constants.ts";

// Better Auth のコアスキーマ。`auth generate --adapter drizzle --dialect sqlite`（auth@1.7.25）の
// 出力に合わせている。列・型・NOT NULL・DEFAULT・外部キーは CLI の出力どおり。
// - テーブル名は複数形なので、drizzleAdapter には usePlural: true を渡す。
// - Drizzle v1 のリレーション（defineRelations）を使うので、アダプターは
//   `@better-auth/drizzle-adapter/relations-v2` を使う。
// - 「このサービス独自」と書いた箇所が CLI の出力にない追加分。

/** CLI が出力する DB 側の既定値（epoch ミリ秒）。 */
const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;
const timestamp = () => integer({ mode: "timestamp_ms" });

export const users = snakeCase.table(
  "users",
  {
    id: text().primaryKey(), // 内部ID。API の応答や URL には出さない
    // 表示名。重複可。length は drizzle-orm/zod が API の入力の検証に使う。DB では下の CHECK で守る。
    name: text({ length: USER_NAME_MAX }).notNull(),
    email: text().notNull().unique(),
    emailVerified: integer({ mode: "boolean" }).default(false).notNull(),
    image: text(), // このサービスでは使わない
    createdAt: timestamp().default(nowMs).notNull(),
    updatedAt: timestamp()
      .default(nowMs)
      .$onUpdate(() => new Date())
      .notNull(),

    // user.additionalFields（このサービス独自）
    // publicId は required: true, input: false, defaultValue でサーバー側が生成する
    publicId: text().notNull().unique(), // URL 用のランダムな公開ID（/u/:publicId）
    bio: text({ length: USER_BIO_MAX }),
    suspendedAt: timestamp(), // 管理者による停止
    // 管理者か。API からは変えられず、DB の SQL で設定する（docs/adr/0018-admin-flag-in-users.md）。
    isAdmin: integer({ mode: "boolean" }).default(false).notNull(),
    // 退会。立てた時点で name・bio・お気に入り・ログイン連携を消し、email を無効な値に置き換える。
    // 行そのものは 90 日後にバッチが物理削除し、CASCADE で投稿なども消える。
    deletedAt: timestamp(),
  },
  (t) => [
    // このサービス独自
    check(
      "users_name_length",
      sql`length(${t.name}) between 1 and ${sql.raw(String(USER_NAME_MAX))}`,
    ),
    check(
      "users_bio_length",
      sql`${t.bio} is null or length(${t.bio}) <= ${sql.raw(String(USER_BIO_MAX))}`,
    ),
    index("users_deleted_at_idx").on(t.deletedAt), // 物理削除バッチ用
  ],
);

export const sessions = snakeCase.table(
  "sessions",
  {
    id: text().primaryKey(),
    expiresAt: timestamp().notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp().default(nowMs).notNull(),
    updatedAt: timestamp()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = snakeCase.table(
  "accounts",
  {
    id: text().primaryKey(),
    accountId: text().notNull(), // プロバイダー側のユーザー ID
    providerId: text().notNull(), // "google"（後で "apple"）
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    password: text(), // パスワード認証は無効だが、コアスキーマの列なので残す
    createdAt: timestamp().default(nowMs).notNull(),
    updatedAt: timestamp()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("accounts_user_id_idx").on(t.userId),
    // このサービス独自。Better Auth はプロバイダー側の ID を (provider_id, account_id) で引く
    index("accounts_provider_account_idx").on(t.providerId, t.accountId),
  ],
);

export const verifications = snakeCase.table(
  "verifications",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().default(nowMs).notNull(),
    updatedAt: timestamp()
      .default(nowMs)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);
