import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
	"users",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		firebaseId: varchar("firebase_id", { length: 128 }).notNull().unique(),
		username: varchar("username", { length: 50 }).notNull(),
		bio: text("bio"),
		birthplace: varchar("birthplace", { length: 100 }),
		birthyear: integer("birthyear"),
		gender: varchar("gender", { length: 20 }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		check(
			"users_birthyear_check",
			sql`${table.birthyear} >= 1900 AND ${table.birthyear} <= EXTRACT(YEAR FROM CURRENT_DATE)`,
		),
		check(
			"users_birthplace_check",
			sql`${table.birthplace} IS NULL OR ${table.birthplace} IN ('Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima', 'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa', 'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi', 'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa')`,
		),
		index("idx_users_username").on(table.username),
	],
);

export const artists = pgTable(
	"artists",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		ipiCode: varchar("ipi_code", { length: 20 }),
		type: varchar("type", { length: 20 }),
		gender: varchar("gender", { length: 20 }),
		birthplace: varchar("birthplace", { length: 100 }),
		birthdate: date("birthdate"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		check("artists_type_check", sql`${table.type} IS NULL OR ${table.type} IN ('person', 'group')`),
		check(
			"artists_birthplace_check",
			sql`${table.birthplace} IS NULL OR ${table.birthplace} IN ('Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima', 'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa', 'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi', 'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa')`,
		),
		index("idx_artists_name").on(table.name),
		index("idx_artists_type").on(table.type),
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
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
		length: integer("length"),
		isrcs: varchar("isrcs", { length: 50 }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
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
		createdAt: timestamp("created_at").notNull().defaultNow(),
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
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
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
		createdAt: timestamp("created_at").notNull().defaultNow(),
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
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
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
		createdAt: timestamp("created_at").notNull().defaultNow(),
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
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.songId] }),
		index("idx_favorite_songs_song_id").on(table.songId),
	],
);

export const posts = pgTable(
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
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		index("idx_posts_user_id").on(table.userId),
		index("idx_posts_song_id").on(table.songId),
		index("idx_posts_not_deleted")
			.on(table.id)
			.where(sql`${table.deletedAt} IS NULL`),
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
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.postId] }),
		index("idx_post_likes_post_id").on(table.postId),
	],
);
