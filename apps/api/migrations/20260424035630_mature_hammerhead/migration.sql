ALTER TYPE "type" RENAME TO "artist_type";--> statement-breakpoint
CREATE INDEX "idx_artists_not_deleted" ON "artists" ("id") WHERE "deleted_at" IS NULL;