ALTER TABLE "users" DROP CONSTRAINT "users_username_min_length";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;