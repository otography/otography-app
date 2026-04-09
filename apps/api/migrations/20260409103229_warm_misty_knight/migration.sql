DROP INDEX "idx_users_username";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_key" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_min_length" CHECK (length(btrim("username")) >= 1);