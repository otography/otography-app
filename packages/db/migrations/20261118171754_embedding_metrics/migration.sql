CREATE TABLE `embedding_metrics` (
	`model` text PRIMARY KEY,
	`version` integer DEFAULT 0 NOT NULL,
	`moments` blob NOT NULL,
	`mean` blob,
	`precision` blob,
	`pnorm_column` text DEFAULT 'pnorm_b' NOT NULL,
	`switched_at` integer,
	`updated_at` integer NOT NULL,
	CONSTRAINT "embedding_metrics_pnorm_column" CHECK("pnorm_column" in ('pnorm_a', 'pnorm_b'))
);
