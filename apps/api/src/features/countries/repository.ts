/**
 * Countries Repository
 *
 * スキーマ定義後にコメントアウトを解除してください。
 *
 * ## インストール
 *
 * ```bash
 * bun add arktype
 * ```
 *
 * ## スキーマ定義（shared/db/schema.ts）
 *
 * ```ts
 * import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
 *
 * export const countries = pgTable("countries", {
 *   id: serial("id").primaryKey(),
 *   name: text("name").notNull(),
 *   iso2: text("iso2"),
 *   iso3: text("iso3"),
 *   createdAt: timestamp("created_at").defaultNow(),
 * });
 *
 * export type Country = typeof countries.$inferSelect;
 * export type NewCountry = typeof countries.$inferInsert;
 * ```
 *
 * ## バリデーションスキーマ（drizzle-orm/arktype使用）
 *
 * ```ts
 * import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-orm/arktype";
 * import { countries } from "../../shared/db/schema";
 * import { pipe, maxLength } from "arktype";
 *
 * // SELECT用（APIレスポンス検証）
 * export const countrySelectSchema = createSelectSchema(countries);
 *
 * // INSERT用（APIリクエスト検証）
 * export const countryInsertSchema = createInsertSchema(countries, {
 *   name: (schema) => pipe(schema, maxLength(100)), // 拡張: 名前は100文字以内
 * });
 *
 * // UPDATE用（APIリクエスト検証）
 * export const countryUpdateSchema = createUpdateSchema(countries, {
 *   name: (schema) => pipe(schema, maxLength(100)),
 * });
 * ```
 *
 * ## リポジトリ実装
 *
 * ```ts
 * import { db } from "../../shared/db";
 * import { countries } from "../../shared/db/schema";
 * import type { Country, NewCountry } from "../../shared/db/schema";
 * import { countryInsertSchema, countryUpdateSchema } from "./schemas";
 * import { eq } from "drizzle-orm";
 *
 * export const countriesRepository = {
 *   findAll: async (): Promise<Country[]> => {
 *     return db.select().from(countries);
 *   },
 *
 *   findById: async (id: number): Promise<Country | undefined> => {
 *     const [country] = await db
 *       .select()
 *       .from(countries)
 *       .where(eq(countries.id, id));
 *     return country;
 *   },
 *
 *   create: async (data: NewCountry): Promise<Country> => {
 *     const parsed = countryInsertSchema(data); // バリデーション
 *     const [country] = await db.insert(countries).values(parsed).returning();
 *     return country;
 *   },
 *
 *   update: async (id: number, data: Partial<NewCountry>): Promise<Country | undefined> => {
 *     const parsed = countryUpdateSchema(data); // バリデーション
 *     const [country] = await db
 *       .update(countries)
 *       .set(parsed)
 *       .where(eq(countries.id, id))
 *       .returning();
 *     return country;
 *   },
 *
 *   delete: async (id: number): Promise<boolean> => {
 *     const [deleted] = await db
 *       .delete(countries)
 *       .where(eq(countries.id, id))
 *       .returning();
 *     return !!deleted;
 *   },
 * };
 * ```
 */
