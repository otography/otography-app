PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY,
	`name` text(50) NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`public_id` text NOT NULL UNIQUE,
	`bio` text(300),
	`suspended_at` integer,
	`deleted_at` integer,
	CONSTRAINT "users_name_length" CHECK(length("name") between 1 and 50),
	CONSTRAINT "users_bio_length" CHECK("bio" is null or length("bio") <= 300)
);
--> statement-breakpoint
INSERT INTO `__new_users`(`id`, `name`, `email`, `email_verified`, `image`, `created_at`, `updated_at`, `public_id`, `bio`, `suspended_at`, `deleted_at`) SELECT `id`, `name`, `email`, `email_verified`, `image`, `created_at`, `updated_at`, `public_id`, `bio`, `suspended_at`, `deleted_at` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_favorite_artists` (
	`user_id` text NOT NULL,
	`comment` text(100),
	`emoji` text,
	`color` text,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`artist_id` text NOT NULL,
	CONSTRAINT `favorite_artists_pk` PRIMARY KEY(`user_id`, `artist_id`),
	CONSTRAINT `fk_favorite_artists_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_favorite_artists_artist_id_artists_id_fk` FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "favorite_artists_comment_length" CHECK("comment" is null or length("comment") <= 100),
	CONSTRAINT "favorite_artists_color" CHECK("color" is null or "color" in ('red', 'orange', 'amber', 'lime', 'green', 'teal', 'sky', 'blue', 'violet', 'pink', 'brown', 'gray'))
);
--> statement-breakpoint
INSERT INTO `__new_favorite_artists`(`user_id`, `comment`, `emoji`, `color`, `position`, `created_at`, `updated_at`, `artist_id`) SELECT `user_id`, `comment`, `emoji`, `color`, `position`, `created_at`, `updated_at`, `artist_id` FROM `favorite_artists`;--> statement-breakpoint
DROP TABLE `favorite_artists`;--> statement-breakpoint
ALTER TABLE `__new_favorite_artists` RENAME TO `favorite_artists`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_favorite_songs` (
	`user_id` text NOT NULL,
	`comment` text(100),
	`emoji` text,
	`color` text,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`song_isrc` text NOT NULL,
	CONSTRAINT `favorite_songs_pk` PRIMARY KEY(`user_id`, `song_isrc`),
	CONSTRAINT `fk_favorite_songs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_favorite_songs_song_isrc_songs_isrc_fk` FOREIGN KEY (`song_isrc`) REFERENCES `songs`(`isrc`) ON DELETE RESTRICT,
	CONSTRAINT "favorite_songs_comment_length" CHECK("comment" is null or length("comment") <= 100),
	CONSTRAINT "favorite_songs_color" CHECK("color" is null or "color" in ('red', 'orange', 'amber', 'lime', 'green', 'teal', 'sky', 'blue', 'violet', 'pink', 'brown', 'gray'))
);
--> statement-breakpoint
INSERT INTO `__new_favorite_songs`(`user_id`, `comment`, `emoji`, `color`, `position`, `created_at`, `updated_at`, `song_isrc`) SELECT `user_id`, `comment`, `emoji`, `color`, `position`, `created_at`, `updated_at`, `song_isrc` FROM `favorite_songs`;--> statement-breakpoint
DROP TABLE `favorite_songs`;--> statement-breakpoint
ALTER TABLE `__new_favorite_songs` RENAME TO `favorite_songs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `users_deleted_at_idx` ON `users` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `favorite_artists_target_idx` ON `favorite_artists` (`artist_id`);--> statement-breakpoint
CREATE INDEX `favorite_songs_target_idx` ON `favorite_songs` (`song_isrc`);