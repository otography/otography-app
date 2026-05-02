import { sql } from "drizzle-orm";
import { createInsertSchema, createUpdateSchema } from "drizzle-orm/arktype";
import { type } from "arktype";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgRole,
  pgTable,
  pgView,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const anonRole = pgRole("anon").existing();
const authenticatedRole = pgRole("authenticated").existing();
export const JAPAN_PREFECTURES = [
  "Hokkaido",
  "Aomori",
  "Iwate",
  "Miyagi",
  "Akita",
  "Yamagata",
  "Fukushima",
  "Ibaraki",
  "Tochigi",
  "Gunma",
  "Saitama",
  "Chiba",
  "Tokyo",
  "Kanagawa",
  "Niigata",
  "Toyama",
  "Ishikawa",
  "Fukui",
  "Yamanashi",
  "Nagano",
  "Gifu",
  "Shizuoka",
  "Aichi",
  "Mie",
  "Shiga",
  "Kyoto",
  "Osaka",
  "Hyogo",
  "Nara",
  "Wakayama",
  "Tottori",
  "Shimane",
  "Okayama",
  "Hiroshima",
  "Yamaguchi",
  "Tokushima",
  "Kagawa",
  "Ehime",
  "Kochi",
  "Fukuoka",
  "Saga",
  "Nagasaki",
  "Kumamoto",
  "Oita",
  "Miyazaki",
  "Kagoshima",
  "Okinawa",
] as const;

// アーティスト種別
export const artistTypeEnum = pgEnum("artist_type", ["person", "group"]);

// 都道府県（users.birthplace と artists.birthplace で使用）
export const prefectureEnum = pgEnum("prefecture", JAPAN_PREFECTURES);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    firebaseId: varchar("firebase_id", { length: 128 }).notNull().unique(),
    username: varchar("username", { length: 50 }).unique(),
    name: varchar("name", { length: 100 }),
    bio: text("bio"),
    birthplace: prefectureEnum("birthplace"),
    birthyear: integer("birthyear"),
    gender: varchar("gender", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "users_birthyear_check",
      sql`${table.birthyear} >= 1900 AND ${table.birthyear} <= EXTRACT(YEAR FROM CURRENT_DATE)`,
    ),
    check(
      "users_username_min_length",
      sql`${table.username} IS NULL OR length(btrim(${table.username})) >= 1`,
    ),
    pgPolicy("users_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.id} = requesting_user_id()::uuid`,
    }),
    pgPolicy("users_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.id} = requesting_user_id()::uuid`,
      withCheck: sql`${table.id} = requesting_user_id()::uuid`,
    }),
  ],
);

// 公開プロフィール用ビュー（機密カラムを除外）
// 明示的に securityInvoker: false を指定し、ビュー所有者権限で実行（どのロールからも閲覧可能）
export const userProfiles = pgView("user_profiles", {
  id: uuid("id"),
  username: varchar("username", { length: 50 }),
  name: varchar("name", { length: 100 }),
  bio: text("bio"),
  createdAt: timestamp("created_at", { withTimezone: true }),
})
  .with({
    securityInvoker: false,
    securityBarrier: true,
  })
  .as(sql`SELECT id, username, name, bio, created_at FROM users WHERE deleted_at IS NULL`);

export const artists = pgTable(
  "artists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    appleMusicId: varchar("apple_music_id", { length: 100 }).notNull().unique(),
    ipiCode: varchar("ipi_code", { length: 20 }),
    type: artistTypeEnum("type"),
    gender: varchar("gender", { length: 20 }),
    birthplace: prefectureEnum("birthplace"),
    birthdate: date("birthdate", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_artists_name").on(table.name),
    index("idx_artists_type").on(table.type),
    index("idx_artists_not_deleted")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const favoriteArtists = pgTable(
  "favorite_artists",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    comment: text("comment"),
    emoji: varchar("emoji", { length: 20 }),
    color: varchar("color", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.artistId] }),
    index("idx_favorite_artists_artist_id").on(table.artistId),
  ],
);

export const songs = pgTable(
  "songs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    appleMusicId: varchar("apple_music_id", { length: 100 }).notNull().unique(),
    length: integer("length"),
    isrcs: varchar("isrcs", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check("songs_length_check", sql`${table.length} >= 0`),
    index("idx_songs_title").on(table.title),
    index("idx_songs_not_deleted")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const songArtists = pgTable(
  "song_artists",
  {
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    isGuest: boolean("is_guest").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.songId, table.artistId] }),
    index("idx_song_artists_artist_id").on(table.artistId),
  ],
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }),
    description: varchar("description", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "groups_type_check",
      sql`${table.type} IS NULL OR ${table.type} IN ('album', 'playlist', 'other')`,
    ),
    index("idx_groups_name").on(table.name),
    index("idx_groups_not_deleted")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const groupSongs = pgTable(
  "group_songs",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.songId] }),
    index("idx_group_songs_song_id").on(table.songId),
  ],
);

export const genres = pgTable(
  "genres",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: varchar("description", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_genres_not_deleted")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const songGenres = pgTable(
  "song_genres",
  {
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    genreId: uuid("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.songId, table.genreId] }),
    index("idx_song_genres_genre_id").on(table.genreId),
  ],
);

export const favoriteSongs = pgTable(
  "favorite_songs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    comment: text("comment"),
    emoji: varchar("emoji", { length: 20 }),
    color: varchar("color", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.songId] }),
    index("idx_favorite_songs_song_id").on(table.songId),
  ],
);

export const posts = pgTable.withRLS(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_posts_user_id").on(table.userId),
    index("idx_posts_song_id").on(table.songId),
    index("idx_posts_not_deleted")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    pgPolicy("posts_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = requesting_user_id()::uuid`,
    }),
    pgPolicy("posts_select_active", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`${table.deletedAt} IS NULL`,
    }),
    pgPolicy("posts_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = requesting_user_id()::uuid`,
    }),
    pgPolicy("posts_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = requesting_user_id()::uuid`,
      withCheck: sql`${table.userId} = requesting_user_id()::uuid`,
    }),
  ],
);

export const postLikes = pgTable(
  "post_likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.postId] }),
    index("idx_post_likes_post_id").on(table.postId),
  ],
);

// users テーブルの arktype スキーマ
// insert 用: firebaseId, username は必須、name はオプショナル
export const insertUserSchema = createInsertSchema(users);

// update 用: すべてオプショナル（id, firebaseId, createdAt, updatedAt, deletedAt は自動管理のため除外）
export const updateUserSchema = createUpdateSchema(users).omit(
  "id",
  "firebaseId",
  "createdAt",
  "updatedAt",
  "deletedAt",
);

// 初回プロフィール設定用（username, name ともに trim + 1文字以上必須）
export const setupProfileSchema = type.merge(updateUserSchema.pick("username", "name").required(), {
  username: type.pipe(type("string.trim"), type("string >= 1")),
  name: type.pipe(type("string.trim"), type("string >= 1")),
});

// insertUserSchema の型（values 引数に使用）
export type InsertUserValues = typeof insertUserSchema.infer;

// updateUserSchema の型（values 引数に使用）
export type UpdateUserValues = typeof updateUserSchema.infer;

// setupProfileSchema の型（values 引数に使用）
export type SetupProfileValues = typeof setupProfileSchema.infer;
