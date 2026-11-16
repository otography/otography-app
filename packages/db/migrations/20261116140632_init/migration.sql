CREATE TABLE `accounts` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`public_id` text NOT NULL UNIQUE,
	`bio` text,
	`suspended_at` integer,
	`deleted_at` integer,
	CONSTRAINT "users_bio_length" CHECK("bio" is null or length("bio") <= 300)
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `favorite_artists` (
	`user_id` text NOT NULL,
	`comment` text,
	`emoji` text,
	`color` text,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`artist_id` text NOT NULL,
	CONSTRAINT `favorite_artists_pk` PRIMARY KEY(`user_id`, `artist_id`),
	CONSTRAINT `fk_favorite_artists_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_favorite_artists_artist_id_artists_id_fk` FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "favorite_artists_comment_length" CHECK("comment" is null or length("comment") <= 100)
);
--> statement-breakpoint
CREATE TABLE `favorite_songs` (
	`user_id` text NOT NULL,
	`comment` text,
	`emoji` text,
	`color` text,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`song_isrc` text NOT NULL,
	CONSTRAINT `favorite_songs_pk` PRIMARY KEY(`user_id`, `song_isrc`),
	CONSTRAINT `fk_favorite_songs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_favorite_songs_song_isrc_songs_isrc_fk` FOREIGN KEY (`song_isrc`) REFERENCES `songs`(`isrc`) ON DELETE RESTRICT,
	CONSTRAINT "favorite_songs_comment_length" CHECK("comment" is null or length("comment") <= 100)
);
--> statement-breakpoint
CREATE TABLE `post_ip_logs` (
	`post_id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`ip_address` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_post_ip_logs_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY,
	`reporter_id` text,
	`post_id` text,
	`target_user_id` text,
	`reason` text NOT NULL,
	`detail` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	CONSTRAINT `fk_reports_reporter_id_users_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_reports_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_reports_target_user_id_users_id_fk` FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `artists` (
	`id` text PRIMARY KEY,
	`name` text,
	`artwork_url` text,
	`url` text,
	`fetched_at` integer NOT NULL,
	`unavailable_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `songs` (
	`isrc` text PRIMARY KEY,
	`apple_song_id` text NOT NULL UNIQUE,
	`title` text,
	`artist_name` text,
	`album_name` text,
	`duration_ms` integer,
	`artwork_url` text,
	`url` text,
	`artist_ids` text,
	`fetched_at` integer NOT NULL,
	`unavailable_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "songs_isrc_format" CHECK(length("isrc") = 12)
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `likes_pk` PRIMARY KEY(`user_id`, `post_id`),
	CONSTRAINT `fk_likes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_likes_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `post_embeddings` (
	`post_id` text PRIMARY KEY,
	`embedding` F16_BLOB(2048) NOT NULL,
	`model` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_post_embeddings_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`song_isrc` text,
	`content` text NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`impression_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`hidden_at` integer,
	CONSTRAINT `fk_posts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_posts_song_isrc_songs_isrc_fk` FOREIGN KEY (`song_isrc`) REFERENCES `songs`(`isrc`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `accounts_provider_account_idx` ON `accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `users_deleted_at_idx` ON `users` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);--> statement-breakpoint
CREATE INDEX `favorite_artists_target_idx` ON `favorite_artists` (`artist_id`);--> statement-breakpoint
CREATE INDEX `favorite_songs_target_idx` ON `favorite_songs` (`song_isrc`);--> statement-breakpoint
CREATE INDEX `post_ip_logs_created_idx` ON `post_ip_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `reports_status_created_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reports_post_idx` ON `reports` (`post_id`);--> statement-breakpoint
CREATE INDEX `reports_target_user_idx` ON `reports` (`target_user_id`);--> statement-breakpoint
CREATE INDEX `reports_reporter_idx` ON `reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `artists_fetched_at_idx` ON `artists` (`fetched_at`);--> statement-breakpoint
CREATE INDEX `songs_fetched_at_idx` ON `songs` (`fetched_at`);--> statement-breakpoint
CREATE INDEX `likes_post_idx` ON `likes` (`post_id`);--> statement-breakpoint
CREATE INDEX `post_embeddings_vector_idx` ON `post_embeddings` (libsql_vector_idx("embedding", 'metric=cosine', 'compress_neighbors=float1bit', 'max_neighbors=32'));--> statement-breakpoint
CREATE INDEX `post_embeddings_model_idx` ON `post_embeddings` (`model`);--> statement-breakpoint
CREATE INDEX `posts_song_created_idx` ON `posts` (`song_isrc`,`created_at`);--> statement-breakpoint
CREATE INDEX `posts_user_created_idx` ON `posts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `posts_deleted_at_idx` ON `posts` (`deleted_at`);