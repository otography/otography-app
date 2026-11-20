CREATE TABLE `post_similar_cache_items` (
	`post_id` text NOT NULL,
	`include_same_song` integer NOT NULL,
	`rank` integer NOT NULL,
	`similar_post_id` text NOT NULL,
	CONSTRAINT `post_similar_cache_items_pk` PRIMARY KEY(`post_id`, `include_same_song`, `rank`),
	CONSTRAINT `fk_post_similar_cache_items_similar_post_id_posts_id_fk` FOREIGN KEY (`similar_post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
	CONSTRAINT `post_similar_cache_items_cache_fk` FOREIGN KEY (`post_id`,`include_same_song`) REFERENCES `post_similar_caches`(`post_id`,`include_same_song`) ON DELETE CASCADE,
	CONSTRAINT "post_similar_cache_items_rank" CHECK("rank" >= 0)
);
--> statement-breakpoint
CREATE TABLE `post_similar_caches` (
	`post_id` text NOT NULL,
	`include_same_song` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT `post_similar_caches_pk` PRIMARY KEY(`post_id`, `include_same_song`),
	CONSTRAINT `fk_post_similar_caches_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
	CONSTRAINT "post_similar_caches_include_same_song" CHECK("include_same_song" in (0, 1))
);
--> statement-breakpoint
CREATE INDEX `post_similar_cache_items_similar_post_idx` ON `post_similar_cache_items` (`similar_post_id`);--> statement-breakpoint
CREATE INDEX `post_similar_caches_expires_at_idx` ON `post_similar_caches` (`expires_at`);