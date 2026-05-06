CREATE INDEX "idx_artists_created_at_id_active" ON "artists" ("created_at","id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_favorite_artists_user_created" ON "favorite_artists" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_favorite_songs_user_created" ON "favorite_songs" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_posts_created_at_id_active" ON "posts" ("created_at","id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_songs_created_at_id_active" ON "songs" ("created_at","id") WHERE "deleted_at" IS NULL;