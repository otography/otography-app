/**
 * Drizzle ORM Schema Definition
 *
 * ## テーブル追加の手順
 *
 * 1. このファイルに新しいテーブルを定義:
 *    ```ts
 *    export const yourTable = pgTable("your_table", {
 *      id: serial("id").primaryKey(),
 *      // ...
 *    });
 *    ```
 *
 * 2. 型をエクスポート:
 *    ```ts
 *    export type YourTable = typeof yourTable.$inferSelect;
 *    export type NewYourTable = typeof yourTable.$inferInsert;
 *    ```
 *
 * 3. マイグレーションを生成:
 *    ```bash
 *    bun run db:generate
 *    ```
 *
 * 4. DBに適用:
 *    ```bash
 *    bun run db:push
 *    ```
 *
 * ## よく使うカラム型
 *
 * - `serial("id").primaryKey()` - 自動採番の主キー
 * - `text("name").notNull()` - NOT NULL テキスト
 * - `text("email").unique()` - ユニーク制約
 * - `timestamp("created_at").defaultNow()` - 自動設定されるタイムスタンプ
 * - `integer("user_id").references(() => users.id)` - 外部キー
 *
 * ## Supabase Auth の users テーブルを参照する方法
 *
 * Supabaseの `auth.users` テーブルへの外部キーを定義する場合:
 *
 * ```ts
 * import { pgSchema, pgTable, serial, text, uuid } from "drizzle-orm/pg-core";
 *
 * // auth スキーマを定義（参照用、マイグレーションは生成されない）
 * const authSchema = pgSchema("auth");
 *
 * export const authUsers = authSchema.table("users", {
 *   id: uuid("id").primaryKey(),
 * });
 *
 * // 自分のテーブルから auth.users を参照
 * export const profiles = pgTable("profiles", {
 *   id: uuid("id")
 *     .primaryKey()
 *     .references(() => authUsers.id, { onDelete: "cascade" }),
 *   name: text("name").notNull(),
 * });
 * ```
 *
 * `drizzle.config.ts` で `schemaFilter: ["public"]` を設定して、
 * auth スキーマはマイグレーション対象外にする:
 *
 * ```ts
 * export default {
 *   schemaFilter: ["public"],
 * } satisfies Config;
 * ```
 *
 * @see https://orm.drizzle.team/docs/column-types/pg
 * @see https://github.com/supabase/supabase/issues/19883
 */

// Example: Users table (必要に応じてコメントアウトを外して編集)
/*
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
*/

// Example: Countries table
/*
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const countries = pgTable("countries", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	iso2: text("iso2"),
	iso3: text("iso3"),
	createdAt: timestamp("created_at").defaultNow(),
});

export type Country = typeof countries.$inferSelect;
export type NewCountry = typeof countries.$inferInsert;
*/

// 空のエクスポート（スキーマ未定義時）
export {};
