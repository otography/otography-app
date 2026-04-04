DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		CREATE ROLE authenticated;
	END IF;
END
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS text
LANGUAGE sql
STABLE
RETURNS NULL ON NULL INPUT
SET search_path = pg_catalog
AS $$
    SELECT NULLIF(
        current_setting('request.jwt.claims', true)::json->>'sub',
        ''
    )::text;
$$;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY,
	"email" text,
	"display_name" text,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "profiles_select_own" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."id" = requesting_user_id());--> statement-breakpoint
CREATE POLICY "profiles_insert_own" ON "profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("profiles"."id" = requesting_user_id());--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("profiles"."id" = requesting_user_id()) WITH CHECK ("profiles"."id" = requesting_user_id());--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"ipi_code" varchar(20),
	"type" varchar(20),
	"gender" varchar(20),
	"birthplace" varchar(100),
	"birthdate" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "artists_type_check" CHECK ("type" IS NULL OR "type" IN ('person', 'group')),
	CONSTRAINT "artists_birthplace_check" CHECK ("birthplace" IS NULL OR "birthplace" IN ('Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima', 'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa', 'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi', 'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa'))
);
--> statement-breakpoint
CREATE TABLE "favorite_artists" (
	"user_id" uuid,
	"artist_id" uuid,
	"comment" text,
	"emoji" varchar(20),
	"color" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_artists_pkey" PRIMARY KEY("user_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "favorite_songs" (
	"user_id" uuid,
	"song_id" uuid,
	"comment" text,
	"emoji" varchar(20),
	"color" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_songs_pkey" PRIMARY KEY("user_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(100) NOT NULL UNIQUE,
	"description" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "group_songs" (
	"group_id" uuid,
	"song_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_songs_pkey" PRIMARY KEY("group_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"type" varchar(50),
	"description" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "groups_type_check" CHECK ("type" IS NULL OR "type" IN ('album', 'playlist', 'other'))
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"user_id" uuid,
	"post_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_likes_pkey" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "song_artists" (
	"song_id" uuid,
	"artist_id" uuid,
	"is_guest" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "song_artists_pkey" PRIMARY KEY("song_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "song_genres" (
	"song_id" uuid,
	"genre_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "song_genres_pkey" PRIMARY KEY("song_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" varchar(255) NOT NULL,
	"length" integer,
	"isrcs" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "songs_length_check" CHECK ("length" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"firebase_id" varchar(128) NOT NULL UNIQUE,
	"username" varchar(50) NOT NULL,
	"bio" text,
	"birthplace" varchar(100),
	"birthyear" integer,
	"gender" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_birthyear_check" CHECK ("birthyear" >= 1900 AND "birthyear" <= EXTRACT(YEAR FROM CURRENT_DATE)),
	CONSTRAINT "users_birthplace_check" CHECK ("birthplace" IS NULL OR "birthplace" IN ('Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima', 'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa', 'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi', 'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa'))
);
--> statement-breakpoint
CREATE INDEX "idx_artists_name" ON "artists" ("name");--> statement-breakpoint
CREATE INDEX "idx_artists_type" ON "artists" ("type");--> statement-breakpoint
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
CREATE INDEX "idx_users_username" ON "users" ("username");--> statement-breakpoint
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
ALTER TABLE "song_genres" ADD CONSTRAINT "song_genres_genre_id_genres_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE;
