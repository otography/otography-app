import { createInsertSchema, createUpdateSchema } from "drizzle-orm/arktype";
import { type } from "arktype";
import { artists } from "../../shared/db/schema";

// アーティスト登録APIのリクエストボディ（appleMusicIdのみ受け取る）
export const artistCreateBodySchema = type({
  appleMusicId: type.pipe(type("string.trim"), type("1 <= string <= 100")),
});

export type ArtistCreateBody = typeof artistCreateBodySchema.infer;

// Apple Music API レスポンスから構築するDB挿入値
const artistDbInsertSchema = createInsertSchema(artists, {
  name: (s) => type.pipe(s, type("1 <= string <= 255")),
  appleMusicId: (s) => type.pipe(s, type("string.trim"), type("1 <= string <= 100")),
  ipiCode: (s) => type.pipe(s, type("null | string <= 20")),
  gender: (s) => type.pipe(s, type("null | string <= 20")),
  birthdate: (s) => type.pipe(s, type("null | string.date.iso")),
}).pick("name", "appleMusicId", "ipiCode", "type", "gender", "birthplace", "birthdate");

export type ArtistCreateDbValues = typeof artistDbInsertSchema.infer;

// アーティスト更新用スキーマ（PATCH、既存のまま）
export const artistUpdateSchema = createUpdateSchema(artists, {
  name: (s) => type.pipe(s, type("1 <= string <= 255")),
  appleMusicId: (s) => type.pipe(s, type("string.trim"), type("1 <= string <= 100")),
  ipiCode: (s) => type.pipe(s, type("null | string <= 20")),
  gender: (s) => type.pipe(s, type("null | string <= 20")),
  birthdate: (s) => type.pipe(s, type("null | string.date.iso")),
}).pick("name", "appleMusicId", "ipiCode", "type", "gender", "birthplace", "birthdate");

export type ArtistUpdateDbModel = typeof artistUpdateSchema.infer;
