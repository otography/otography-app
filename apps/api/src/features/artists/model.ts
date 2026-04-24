import { createInsertSchema, createUpdateSchema } from "drizzle-orm/arktype";
import { type } from "arktype";
import { artists } from "../../shared/db/schema";

// drizzle-orm/arktype から insert/update スキーマを生成
// pgEnum の type/birthplace は自動的にユニオン型になる
// コールバックで元スキーマを拡張（nullable/optional性を保持）
export const artistInsertSchema = createInsertSchema(artists, {
  name: (s) => type.pipe(s, type("1 <= string <= 255")),
  ipiCode: (s) => type.pipe(s, type("string <= 20")),
  gender: (s) => type.pipe(s, type("string <= 20")),
  birthdate: (s) => type.pipe(s, type("string.date.iso")),
}).pick("name", "ipiCode", "type", "gender", "birthplace", "birthdate");

export const artistUpdateSchema = createUpdateSchema(artists, {
  name: (s) => type.pipe(s, type("1 <= string <= 255")),
  ipiCode: (s) => type.pipe(s, type("string <= 20")),
  gender: (s) => type.pipe(s, type("string <= 20")),
  birthdate: (s) => type.pipe(s, type("string.date.iso")),
}).pick("name", "ipiCode", "type", "gender", "birthplace", "birthdate");

export type ArtistCreateDbModel = typeof artistInsertSchema.infer;
export type ArtistUpdateDbModel = typeof artistUpdateSchema.infer;
