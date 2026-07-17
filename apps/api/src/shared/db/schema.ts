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
const requestingUserId = sql`(SELECT requesting_user_id())`;
const uuidV7 = (name: string) => uuid(name).default(sql`uuid_generate_v7()`);
const JAPAN_PREFECTURES = [
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

/** @db-schema */
export const artistTypeEnum = pgEnum("artist_type", ["person", "group"]);

/** @db-schema */
export const prefectureEnum = pgEnum("prefecture", JAPAN_PREFECTURES);

export const users = pgTable(
  "users",
  {
    id: uuidV7("id").primaryKey(),
    firebaseId: varchar("firebase_id", { length: 128 }).notNull().unique(),
    username: varchar("username", { length: 50 }).unique(),
    name: varchar("name", { length: 100 }),
    bio: text("bio"),
    birthplace: prefectureEnum("birthplace"),
    birthyear: integer("birthyear"),
    gender: varchar("gender", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
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
      using: sql`${table.id} = ${requestingUserId}`,
    }),
    pgPolicy("users_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.id} = ${requestingUserId}`,
      withCheck: sql`${table.id} = ${requestingUserId}`,
    }),
  ],
);

// 公開プロフィール用ビュー（機密カラムを除外）
export const userProfiles = pgView("user_profiles", {
  id: uuid("id"),
  username: varchar("username", { length: 50 }),
  name: varchar("name", { length: 100 }),
  bio: text("bio"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
})
  .with({
    securityBarrier: true,
  })
  .as(sql`SELECT id, username, name, bio, created_at FROM users WHERE deleted_at IS NULL`);

export const artists = pgTable.withRLS(
  "artists",
  {
    id: uuidV7("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    appleMusicId: varchar("apple_music_id", { length: 100 }).notNull().unique(),
    ipiCode: varchar("ipi_code", { length: 20 }),
    type: artistTypeEnum("type"),
    gender: varchar("gender", { length: 20 }),
    birthplace: prefectureEnum("birthplace"),
    birthdate: date("birthdate", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("idx_artists_name").on(table.name),
    index("idx_artists_type").on(table.type),
    index("idx_artists_not_deleted")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_artists_created_at_id_active")
      .on(table.createdAt, table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    pgPolicy("artists_select_active", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`${table.deletedAt} IS NULL`,
    }),
    // 復活 upsert(ON CONFLICT DO UPDATE)は競合行の読み取りに SELECT ポリシーが適用されるため、
    // authenticated は論理削除済み行も読める必要がある(公開読み取りは anon ロールで行う)
    pgPolicy("artists_select_all_authenticated", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    pgPolicy("artists_insert_authenticated", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`true`,
    }),
    pgPolicy("artists_update_authenticated", {
      for: "update",
      to: authenticatedRole,
      using: sql`true`,
      withCheck: sql`${table.deletedAt} IS NULL`,
    }),
  ],
);

export const favoriteArtists = pgTable.withRLS(
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.artistId] }),
    index("idx_favorite_artists_artist_id").on(table.artistId),
    index("idx_favorite_artists_user_created").on(table.userId, table.createdAt.desc()),
    pgPolicy("favorite_artists_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${requestingUserId}`,
    }),
    pgPolicy("favorite_artists_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${requestingUserId}`,
    }),
    pgPolicy("favorite_artists_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${requestingUserId}`,
    }),
  ],
);

export const songs = pgTable.withRLS(
  "songs",
  {
    id: uuidV7("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    appleMusicId: varchar("apple_music_id", { length: 100 }).notNull().unique(),
    length: integer("length"),
    isrcs: varchar("isrcs", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    check("songs_length_check", sql`${table.length} >= 0`),
    index("idx_songs_title").on(table.title),
    index("idx_songs_not_deleted")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_songs_created_at_id_active")
      .on(table.createdAt, table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    pgPolicy("songs_select_active", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`${table.deletedAt} IS NULL`,
    }),
    // 復活 upsert(ON CONFLICT DO UPDATE)は競合行の読み取りに SELECT ポリシーが適用されるため、
    // authenticated は論理削除済み行も読める必要がある(公開読み取りは anon ロールで行う)
    pgPolicy("songs_select_all_authenticated", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    pgPolicy("songs_insert_authenticated", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`true`,
    }),
    pgPolicy("songs_update_authenticated", {
      for: "update",
      to: authenticatedRole,
      using: sql`true`,
      withCheck: sql`${table.deletedAt} IS NULL`,
    }),
  ],
);

export const songArtists = pgTable.withRLS(
  "song_artists",
  {
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    isGuest: boolean("is_guest").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.songId, table.artistId] }),
    index("idx_song_artists_artist_id").on(table.artistId),
    pgPolicy("song_artists_select_active", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`EXISTS (SELECT 1 FROM ${songs} WHERE ${songs.id} = ${table.songId} AND ${songs.deletedAt} IS NULL) AND EXISTS (SELECT 1 FROM ${artists} WHERE ${artists.id} = ${table.artistId} AND ${artists.deletedAt} IS NULL)`,
    }),
    pgPolicy("song_artists_insert_authenticated", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`true`,
    }),
    pgPolicy("song_artists_delete_authenticated", {
      for: "delete",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);

/** @db-schema */
export const groups = pgTable.withRLS(
  "groups",
  {
    id: uuidV7("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }),
    description: varchar("description", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
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

/** @db-schema */
export const groupSongs = pgTable.withRLS(
  "group_songs",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.songId] }),
    index("idx_group_songs_song_id").on(table.songId),
  ],
);

export const genres = pgTable.withRLS(
  "genres",
  {
    id: uuidV7("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: varchar("description", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("idx_genres_not_deleted")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    pgPolicy("genres_select_active", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`${table.deletedAt} IS NULL`,
    }),
    pgPolicy("genres_insert_authenticated", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`true`,
    }),
    pgPolicy("genres_update_authenticated", {
      for: "update",
      to: authenticatedRole,
      using: sql`true`,
      withCheck: sql`${table.deletedAt} IS NULL`,
    }),
  ],
);

export const songGenres = pgTable.withRLS(
  "song_genres",
  {
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    genreId: uuid("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.songId, table.genreId] }),
    index("idx_song_genres_genre_id").on(table.genreId),
    pgPolicy("song_genres_select_active", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`EXISTS (SELECT 1 FROM ${songs} WHERE ${songs.id} = ${table.songId} AND ${songs.deletedAt} IS NULL) AND EXISTS (SELECT 1 FROM ${genres} WHERE ${genres.id} = ${table.genreId} AND ${genres.deletedAt} IS NULL)`,
    }),
    pgPolicy("song_genres_insert_authenticated", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`true`,
    }),
    pgPolicy("song_genres_delete_authenticated", {
      for: "delete",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);

export const favoriteSongs = pgTable.withRLS(
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.songId] }),
    index("idx_favorite_songs_song_id").on(table.songId),
    index("idx_favorite_songs_user_created").on(table.userId, table.createdAt.desc()),
    pgPolicy("favorite_songs_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${requestingUserId}`,
    }),
    pgPolicy("favorite_songs_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${requestingUserId}`,
    }),
    pgPolicy("favorite_songs_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${requestingUserId}`,
    }),
  ],
);

export const posts = pgTable.withRLS(
  "posts",
  {
    id: uuidV7("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("idx_posts_user_id").on(table.userId),
    index("idx_posts_song_id").on(table.songId),
    index("idx_posts_not_deleted")
      .on(table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_posts_created_at_id_active")
      .on(table.createdAt, table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    pgPolicy("posts_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${requestingUserId}`,
    }),
    pgPolicy("posts_select_active", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`${table.deletedAt} IS NULL`,
    }),
    pgPolicy("posts_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${requestingUserId}`,
    }),
    pgPolicy("posts_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${requestingUserId}`,
      withCheck: sql`${table.userId} = ${requestingUserId}`,
    }),
  ],
);

/** @db-schema */
export const postLikes = pgTable.withRLS(
  "post_likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.postId] }),
    index("idx_post_likes_post_id").on(table.postId),
    pgPolicy("post_likes_select_all", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
    pgPolicy("post_likes_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${requestingUserId}`,
    }),
    pgPolicy("post_likes_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${requestingUserId}`,
    }),
  ],
);

// users テーブルの arktype スキーマ
// insert 用: firebaseId, username は必須、name はオプショナル
const insertUserSchema = createInsertSchema(users);

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
