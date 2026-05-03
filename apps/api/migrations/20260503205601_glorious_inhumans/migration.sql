ALTER VIEW "user_profiles" SET (security_invoker = true);--> statement-breakpoint
ALTER TABLE "artists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "favorite_artists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "favorite_songs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "genres" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group_songs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "song_artists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "song_genres" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "songs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "artists_select_active" ON "artists" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("artists"."deleted_at" IS NULL);--> statement-breakpoint
CREATE POLICY "artists_insert_authenticated" ON "artists" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "artists_update_authenticated" ON "artists" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "favorite_artists_select_own" ON "favorite_artists" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("favorite_artists"."user_id" = (SELECT requesting_user_id()));--> statement-breakpoint
CREATE POLICY "favorite_artists_insert_own" ON "favorite_artists" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("favorite_artists"."user_id" = (SELECT requesting_user_id()));--> statement-breakpoint
CREATE POLICY "favorite_artists_delete_own" ON "favorite_artists" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("favorite_artists"."user_id" = (SELECT requesting_user_id()));--> statement-breakpoint
CREATE POLICY "favorite_songs_select_own" ON "favorite_songs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("favorite_songs"."user_id" = (SELECT requesting_user_id()));--> statement-breakpoint
CREATE POLICY "favorite_songs_insert_own" ON "favorite_songs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("favorite_songs"."user_id" = (SELECT requesting_user_id()));--> statement-breakpoint
CREATE POLICY "favorite_songs_delete_own" ON "favorite_songs" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("favorite_songs"."user_id" = (SELECT requesting_user_id()));--> statement-breakpoint
CREATE POLICY "songs_select_active" ON "songs" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("songs"."deleted_at" IS NULL);--> statement-breakpoint
CREATE POLICY "songs_insert_authenticated" ON "songs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "songs_update_authenticated" ON "songs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);