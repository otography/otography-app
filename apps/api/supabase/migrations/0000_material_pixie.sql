CREATE TYPE "public"."artist_type" AS ENUM('person', 'group');--> statement-breakpoint
CREATE TYPE "public"."birthplace" AS ENUM('Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima', 'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa', 'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi', 'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa');--> statement-breakpoint
CREATE TYPE "public"."group_type" AS ENUM('album', 'playlist', 'other');--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"ipi_code" varchar(20),
	"type" "artist_type",
	"gender" varchar(20),
	"birthplace" "birthplace",
	"birthdate" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "favorite_artists" (
	"user_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"comment" text,
	"emoji" varchar(20),
	"color" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_artists_user_id_artist_id_pk" PRIMARY KEY("user_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "favorite_songs" (
	"user_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"comment" text,
	"emoji" varchar(20),
	"color" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_songs_user_id_song_id_pk" PRIMARY KEY("user_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "genres_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "group_songs" (
	"group_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_songs_group_id_song_id_pk" PRIMARY KEY("group_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "group_type",
	"description" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_likes_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "song_artists" (
	"song_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"is_guest" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "song_artists_song_id_artist_id_pk" PRIMARY KEY("song_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "song_genres" (
	"song_id" uuid NOT NULL,
	"genre_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "song_genres_song_id_genre_id_pk" PRIMARY KEY("song_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"length" integer,
	"isrcs" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "songs_length_check" CHECK ("songs"."length" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_id" varchar(128) NOT NULL,
	"username" varchar(50) NOT NULL,
	"bio" text,
	"birthplace" "birthplace",
	"birthyear" integer,
	"gender" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_firebase_id_unique" UNIQUE("firebase_id"),
	CONSTRAINT "users_birthyear_check" CHECK ("users"."birthyear" >= 1900 AND "users"."birthyear" <= EXTRACT(YEAR FROM CURRENT_DATE))
);
--> statement-breakpoint
ALTER TABLE "favorite_artists" ADD CONSTRAINT "favorite_artists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_artists" ADD CONSTRAINT "favorite_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_songs" ADD CONSTRAINT "favorite_songs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_songs" ADD CONSTRAINT "favorite_songs_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_songs" ADD CONSTRAINT "group_songs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_songs" ADD CONSTRAINT "group_songs_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_artists" ADD CONSTRAINT "song_artists_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_artists" ADD CONSTRAINT "song_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_genres" ADD CONSTRAINT "song_genres_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_genres" ADD CONSTRAINT "song_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_artists_name" ON "artists" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_artists_type" ON "artists" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_favorite_artists_artist_id" ON "favorite_artists" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_favorite_songs_song_id" ON "favorite_songs" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "idx_genres_not_deleted" ON "genres" USING btree ("id") WHERE "genres"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_group_songs_song_id" ON "group_songs" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "idx_groups_name" ON "groups" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_groups_not_deleted" ON "groups" USING btree ("id") WHERE "groups"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_post_likes_post_id" ON "post_likes" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_posts_user_id" ON "posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_posts_song_id" ON "posts" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "idx_posts_not_deleted" ON "posts" USING btree ("id") WHERE "posts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_song_artists_artist_id" ON "song_artists" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_song_genres_genre_id" ON "song_genres" USING btree ("genre_id");--> statement-breakpoint
CREATE INDEX "idx_songs_title" ON "songs" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_songs_not_deleted" ON "songs" USING btree ("id") WHERE "songs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");