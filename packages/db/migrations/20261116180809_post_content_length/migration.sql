PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_posts` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`song_isrc` text,
	`content` text(140) NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`impression_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`hidden_at` integer,
	CONSTRAINT `fk_posts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_posts_song_isrc_songs_isrc_fk` FOREIGN KEY (`song_isrc`) REFERENCES `songs`(`isrc`) ON DELETE RESTRICT,
	CONSTRAINT "posts_content_length" CHECK(length("content") between 1 and 140)
);
--> statement-breakpoint
INSERT INTO `__new_posts`(`id`, `user_id`, `song_isrc`, `content`, `like_count`, `impression_count`, `created_at`, `updated_at`, `deleted_at`, `hidden_at`) SELECT `id`, `user_id`, `song_isrc`, `content`, `like_count`, `impression_count`, `created_at`, `updated_at`, `deleted_at`, `hidden_at` FROM `posts`;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
ALTER TABLE `__new_posts` RENAME TO `posts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_songs` (
	`isrc` text(12) PRIMARY KEY,
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
INSERT INTO `__new_songs`(`isrc`, `apple_song_id`, `title`, `artist_name`, `album_name`, `duration_ms`, `artwork_url`, `url`, `artist_ids`, `fetched_at`, `unavailable_at`, `created_at`) SELECT `isrc`, `apple_song_id`, `title`, `artist_name`, `album_name`, `duration_ms`, `artwork_url`, `url`, `artist_ids`, `fetched_at`, `unavailable_at`, `created_at` FROM `songs`;--> statement-breakpoint
DROP TABLE `songs`;--> statement-breakpoint
ALTER TABLE `__new_songs` RENAME TO `songs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `posts_song_created_idx` ON `posts` (`song_isrc`,`created_at`);--> statement-breakpoint
CREATE INDEX `posts_user_created_idx` ON `posts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `posts_deleted_at_idx` ON `posts` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `songs_fetched_at_idx` ON `songs` (`fetched_at`);