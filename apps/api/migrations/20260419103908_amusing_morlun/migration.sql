ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "embedding" vector(1024);--> statement-breakpoint
CREATE INDEX "posts_embedding_cosine_idx" ON "posts" USING hnsw ("embedding" vector_cosine_ops) WHERE "deleted_at" IS NULL AND "embedding" IS NOT NULL;--> statement-breakpoint
CREATE POLICY "posts_select_all" ON "posts" AS PERMISSIVE FOR SELECT TO public USING ("posts"."deleted_at" IS NULL);--> statement-breakpoint
CREATE POLICY "posts_insert_own" ON "posts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("posts"."user_id" IN (SELECT id FROM users WHERE firebase_id = requesting_user_id()));--> statement-breakpoint
CREATE POLICY "posts_update_own" ON "posts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("posts"."user_id" IN (SELECT id FROM users WHERE firebase_id = requesting_user_id())) WITH CHECK ("posts"."user_id" IN (SELECT id FROM users WHERE firebase_id = requesting_user_id()));--> statement-breakpoint
CREATE POLICY "posts_delete_own" ON "posts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("posts"."user_id" IN (SELECT id FROM users WHERE firebase_id = requesting_user_id()));