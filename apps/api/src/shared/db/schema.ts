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
 * @see https://orm.drizzle.team/docs/column-types/pg
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

// 空のエクスポート（スキーマ未定義時）
export {};
