ALTER TABLE "server_sessions" ADD CONSTRAINT "server_sessions_session_hash_format_check" CHECK ("session_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "server_sessions" ADD CONSTRAINT "server_sessions_key_version_not_empty_check" CHECK (length("key_version") > 0);--> statement-breakpoint
ALTER TABLE "server_sessions" ADD CONSTRAINT "server_sessions_version_positive_check" CHECK ("version" > 0);--> statement-breakpoint
ALTER TABLE "server_sessions" ADD CONSTRAINT "server_sessions_expiry_order_check" CHECK ("idle_expires_at" <= "absolute_expires_at");