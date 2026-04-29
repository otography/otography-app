DROP POLICY "users_select_all" ON "users";--> statement-breakpoint
CREATE VIEW "user_profiles" WITH (security_barrier = true, security_invoker = true) AS (SELECT id, username, name, bio, created_at FROM users WHERE deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY "users_select_own" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("users"."id" = requesting_user_id()::uuid);