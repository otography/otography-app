ALTER POLICY "post_likes_insert_own" ON "post_likes" TO "authenticated" WITH CHECK ("post_likes"."user_id" = (SELECT requesting_user_id())::uuid);--> statement-breakpoint
ALTER POLICY "post_likes_delete_own" ON "post_likes" TO "authenticated" USING ("post_likes"."user_id" = (SELECT requesting_user_id())::uuid);--> statement-breakpoint
ALTER POLICY "posts_insert_own" ON "posts" TO "authenticated" WITH CHECK ("posts"."user_id" = (SELECT requesting_user_id())::uuid);--> statement-breakpoint
ALTER POLICY "posts_select_own" ON "posts" TO "authenticated" USING ("posts"."user_id" = (SELECT requesting_user_id())::uuid);--> statement-breakpoint
ALTER POLICY "posts_update_own" ON "posts" TO "authenticated" USING ("posts"."user_id" = (SELECT requesting_user_id())::uuid) WITH CHECK ("posts"."user_id" = (SELECT requesting_user_id())::uuid);--> statement-breakpoint
ALTER POLICY "users_select_own" ON "users" TO "authenticated" USING ("users"."id" = (SELECT requesting_user_id())::uuid);--> statement-breakpoint
ALTER POLICY "users_update_own" ON "users" TO "authenticated" USING ("users"."id" = (SELECT requesting_user_id())::uuid) WITH CHECK ("users"."id" = (SELECT requesting_user_id())::uuid);