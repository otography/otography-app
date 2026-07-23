CREATE TABLE "server_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
	"session_hash" varchar(64) NOT NULL UNIQUE,
	"user_id" uuid NOT NULL,
	"encrypted_session_credential" jsonb NOT NULL,
	"encrypted_refresh_token" jsonb NOT NULL,
	"key_version" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"version" bigint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_server_sessions_user_id" ON "server_sessions" ("user_id");--> statement-breakpoint
ALTER TABLE "server_sessions" ADD CONSTRAINT "server_sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
-- server_sessions はバックエンド基盤テーブルのため、anon/authenticated ロールのアクセスを拒否
REVOKE ALL PRIVILEGES ON "server_sessions" FROM "anon", "authenticated";
