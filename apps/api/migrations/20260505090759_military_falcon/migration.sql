CREATE POLICY "genres_select_active" ON "genres" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("genres"."deleted_at" IS NULL);--> statement-breakpoint
CREATE POLICY "genres_insert_authenticated" ON "genres" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "genres_update_authenticated" ON "genres" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "song_artists_select_all" ON "song_artists" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "song_artists_insert_authenticated" ON "song_artists" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "song_artists_delete_authenticated" ON "song_artists" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "song_genres_select_all" ON "song_genres" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "song_genres_insert_authenticated" ON "song_genres" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "song_genres_delete_authenticated" ON "song_genres" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);