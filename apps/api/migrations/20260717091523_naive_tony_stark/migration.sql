CREATE POLICY "artists_select_all_authenticated" ON "artists" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "songs_select_all_authenticated" ON "songs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
ALTER POLICY "artists_update_authenticated" ON "artists" TO "authenticated" USING (true) WITH CHECK ("artists"."deleted_at" IS NULL);--> statement-breakpoint
ALTER POLICY "genres_update_authenticated" ON "genres" TO "authenticated" USING (true) WITH CHECK ("genres"."deleted_at" IS NULL);--> statement-breakpoint
ALTER POLICY "songs_update_authenticated" ON "songs" TO "authenticated" USING (true) WITH CHECK ("songs"."deleted_at" IS NULL);