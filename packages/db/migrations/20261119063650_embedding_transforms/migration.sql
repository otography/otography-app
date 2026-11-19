CREATE TABLE `embedding_transforms` (
	`model` text PRIMARY KEY,
	`a` blob NOT NULL,
	`b` blob NOT NULL,
	`created_at` integer NOT NULL
);
