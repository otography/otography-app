ALTER VIEW "user_profiles" SET (security_invoker = false);--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "apple_music_id" varchar(100);--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "apple_music_id" varchar(100);--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_apple_music_id_key" UNIQUE("apple_music_id");--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_apple_music_id_key" UNIQUE("apple_music_id");