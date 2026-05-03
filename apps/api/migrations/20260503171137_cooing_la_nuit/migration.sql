CREATE TYPE "artist_type" AS ENUM('person', 'group');--> statement-breakpoint
CREATE TYPE "prefecture" AS ENUM('Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima', 'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa', 'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi', 'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa');--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
	"name" varchar(255) NOT NULL,
	"apple_music_id" varchar(100) NOT NULL UNIQUE,
	"ipi_code" varchar(20),
	"type" "artist_type",
	"gender" varchar(20),
	"birthplace" "prefecture",
	"birthdate" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "favorite_artists" (
	"user_id" uuid,
	"artist_id" uuid,
	"comment" text,
	"emoji" varchar(20),
	"color" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_artists_pkey" PRIMARY KEY("user_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "favorite_songs" (
	"user_id" uuid,
	"song_id" uuid,
	"comment" text,
	"emoji" varchar(20),
	"color" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_songs_pkey" PRIMARY KEY("user_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
	"name" varchar(100) NOT NULL UNIQUE,
	"description" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "group_songs" (
	"group_id" uuid,
	"song_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_songs_pkey" PRIMARY KEY("group_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
	"name" varchar(255) NOT NULL,
	"type" varchar(50),
	"description" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "groups_type_check" CHECK ("type" IS NULL OR "type" IN ('album', 'playlist', 'other'))
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"user_id" uuid,
	"post_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_likes_pkey" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
ALTER TABLE "post_likes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
	"user_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "song_artists" (
	"song_id" uuid,
	"artist_id" uuid,
	"is_guest" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "song_artists_pkey" PRIMARY KEY("song_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "song_genres" (
	"song_id" uuid,
	"genre_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "song_genres_pkey" PRIMARY KEY("song_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
	"title" varchar(255) NOT NULL,
	"apple_music_id" varchar(100) NOT NULL UNIQUE,
	"length" integer,
	"isrcs" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "songs_length_check" CHECK ("length" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
	"firebase_id" varchar(128) NOT NULL UNIQUE,
	"username" varchar(50) UNIQUE,
	"name" varchar(100),
	"bio" text,
	"birthplace" "prefecture",
	"birthyear" integer,
	"gender" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_birthyear_check" CHECK ("birthyear" >= 1900 AND "birthyear" <= EXTRACT(YEAR FROM CURRENT_DATE)),
	CONSTRAINT "users_username_min_length" CHECK ("username" IS NULL OR length(btrim("username")) >= 1)
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "idx_artists_name" ON "artists" ("name");--> statement-breakpoint
CREATE INDEX "idx_artists_type" ON "artists" ("type");--> statement-breakpoint
CREATE INDEX "idx_artists_not_deleted" ON "artists" ("id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_favorite_artists_artist_id" ON "favorite_artists" ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_favorite_songs_song_id" ON "favorite_songs" ("song_id");--> statement-breakpoint
CREATE INDEX "idx_genres_not_deleted" ON "genres" ("id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_group_songs_song_id" ON "group_songs" ("song_id");--> statement-breakpoint
CREATE INDEX "idx_groups_name" ON "groups" ("name");--> statement-breakpoint
CREATE INDEX "idx_groups_not_deleted" ON "groups" ("id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_post_likes_post_id" ON "post_likes" ("post_id");--> statement-breakpoint
CREATE INDEX "idx_posts_user_id" ON "posts" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_posts_song_id" ON "posts" ("song_id");--> statement-breakpoint
CREATE INDEX "idx_posts_not_deleted" ON "posts" ("id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_song_artists_artist_id" ON "song_artists" ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_song_genres_genre_id" ON "song_genres" ("genre_id");--> statement-breakpoint
CREATE INDEX "idx_songs_title" ON "songs" ("title");--> statement-breakpoint
CREATE INDEX "idx_songs_not_deleted" ON "songs" ("id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "favorite_artists" ADD CONSTRAINT "favorite_artists_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "favorite_artists" ADD CONSTRAINT "favorite_artists_artist_id_artists_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "favorite_songs" ADD CONSTRAINT "favorite_songs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "favorite_songs" ADD CONSTRAINT "favorite_songs_song_id_songs_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "group_songs" ADD CONSTRAINT "group_songs_group_id_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "group_songs" ADD CONSTRAINT "group_songs_song_id_songs_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_posts_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_song_id_songs_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "song_artists" ADD CONSTRAINT "song_artists_song_id_songs_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "song_artists" ADD CONSTRAINT "song_artists_artist_id_artists_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "song_genres" ADD CONSTRAINT "song_genres_song_id_songs_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "song_genres" ADD CONSTRAINT "song_genres_genre_id_genres_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE VIEW "user_profiles" WITH (security_barrier = true, security_invoker = false) AS (SELECT id, username, name, bio, created_at FROM users WHERE deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "post_likes_select_all" ON "post_likes" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "post_likes_insert_own" ON "post_likes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("post_likes"."user_id" = (SELECT requesting_user_id()));--> statement-breakpoint
CREATE POLICY "post_likes_delete_own" ON "post_likes" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("post_likes"."user_id" = (SELECT requesting_user_id()));--> statement-breakpoint
CREATE POLICY "posts_insert_own" ON "posts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("posts"."user_id" = (SELECT requesting_user_id()));--> statement-breakpoint
CREATE POLICY "posts_select_active" ON "posts" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("posts"."deleted_at" IS NULL);--> statement-breakpoint
CREATE POLICY "posts_select_own" ON "posts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("posts"."user_id" = (SELECT requesting_user_id()));--> statement-breakpoint
CREATE POLICY "posts_update_own" ON "posts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("posts"."user_id" = (SELECT requesting_user_id())) WITH CHECK ("posts"."user_id" = (SELECT requesting_user_id()));--> statement-breakpoint
CREATE POLICY "users_select_own" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("users"."id" = (SELECT requesting_user_id()));--> statement-breakpoint
CREATE POLICY "users_update_own" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("users"."id" = (SELECT requesting_user_id())) WITH CHECK ("users"."id" = (SELECT requesting_user_id()));