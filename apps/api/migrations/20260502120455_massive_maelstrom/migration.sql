ALTER TABLE "post_likes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "post_likes_select_all" ON "post_likes" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "post_likes_insert_own" ON "post_likes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("post_likes"."user_id" = requesting_user_id()::uuid);--> statement-breakpoint
CREATE POLICY "post_likes_delete_own" ON "post_likes" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("post_likes"."user_id" = requesting_user_id()::uuid);--> statement-breakpoint
DROP TYPE "artist_type";--> statement-breakpoint
DROP TYPE "prefecture";