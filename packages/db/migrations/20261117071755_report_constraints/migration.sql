PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reports` (
	`id` text PRIMARY KEY,
	`reporter_id` text,
	`post_id` text,
	`target_user_id` text,
	`reason` text NOT NULL,
	`detail` text(500),
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	CONSTRAINT `fk_reports_reporter_id_users_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_reports_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_reports_target_user_id_users_id_fk` FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
	CONSTRAINT "reports_reason" CHECK("reason" in ('spam', 'harassment', 'inappropriate', 'impersonation', 'other')),
	CONSTRAINT "reports_status" CHECK("status" in ('open', 'resolved', 'dismissed')),
	CONSTRAINT "reports_detail_length" CHECK("detail" is null or length("detail") <= 500)
);
--> statement-breakpoint
INSERT INTO `__new_reports`(`id`, `reporter_id`, `post_id`, `target_user_id`, `reason`, `detail`, `status`, `created_at`, `resolved_at`) SELECT `id`, `reporter_id`, `post_id`, `target_user_id`, `reason`, `detail`, `status`, `created_at`, `resolved_at` FROM `reports`;--> statement-breakpoint
DROP TABLE `reports`;--> statement-breakpoint
ALTER TABLE `__new_reports` RENAME TO `reports`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `reports_status_created_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reports_post_idx` ON `reports` (`post_id`);--> statement-breakpoint
CREATE INDEX `reports_target_user_idx` ON `reports` (`target_user_id`);--> statement-breakpoint
CREATE INDEX `reports_reporter_idx` ON `reports` (`reporter_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reports_open_post_unique` ON `reports` (`reporter_id`,`post_id`) WHERE "reports"."status" = 'open' and "reports"."post_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `reports_open_user_unique` ON `reports` (`reporter_id`,`target_user_id`) WHERE "reports"."status" = 'open' and "reports"."post_id" is null;