ALTER POLICY "users_insert_own" ON "users" TO "authenticated" WITH CHECK ("users"."id" = requesting_user_id()::uuid);--> statement-breakpoint
ALTER POLICY "users_update_own" ON "users" TO "authenticated" USING ("users"."id" = requesting_user_id()::uuid) WITH CHECK ("users"."id" = requesting_user_id()::uuid);
