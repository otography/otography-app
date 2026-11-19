CREATE TABLE `embedding_changes` (
	`seq` integer PRIMARY KEY AUTOINCREMENT,
	`sign` integer NOT NULL,
	`embedding` F16_BLOB(256) NOT NULL,
	`model` text NOT NULL,
	CONSTRAINT "embedding_changes_sign" CHECK("sign" in (1, -1))
);
--> statement-breakpoint
-- 2048 次元の x を保存していた表は、作り直す。x から z は作れないので、行は移さない。
-- このマイグレーションの時点では埋め込みを書き込む処理が無いので、行は無い。
-- 何も参照していない表なので、drizzle-kit が生成した「新しい表に移して名前を変える」手順は使わない。
DROP TABLE `post_embeddings`;--> statement-breakpoint
CREATE TABLE `post_embeddings` (
	`post_id` text PRIMARY KEY,
	`embedding` F16_BLOB(256) NOT NULL,
	`norm` real NOT NULL,
	`pnorm_a` real,
	`pnorm_b` real,
	`model` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_post_embeddings_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
	CONSTRAINT "post_embeddings_norm" CHECK("norm" >= 0)
);
--> statement-breakpoint
CREATE INDEX `post_embeddings_vector_idx` ON `post_embeddings` (libsql_vector_idx("embedding", 'metric=cosine', 'compress_neighbors=float1bit', 'max_neighbors=32'));--> statement-breakpoint
CREATE INDEX `post_embeddings_model_idx` ON `post_embeddings` (`model`);--> statement-breakpoint
-- 統計の差分ログ（embedding_changes）を書くトリガー。drizzle-kit はトリガーを扱えないので、ここに手で書く。
-- 投稿の物理削除（ON DELETE CASCADE）で消えた行にも、削除のトリガーが動く。
CREATE TRIGGER `post_embeddings_log_insert` AFTER INSERT ON `post_embeddings`
BEGIN
	INSERT INTO `embedding_changes`(`sign`, `embedding`, `model`) VALUES (1, new.`embedding`, new.`model`);
END;--> statement-breakpoint
CREATE TRIGGER `post_embeddings_log_delete` AFTER DELETE ON `post_embeddings`
BEGIN
	INSERT INTO `embedding_changes`(`sign`, `embedding`, `model`) VALUES (-1, old.`embedding`, old.`model`);
END;--> statement-breakpoint
CREATE TRIGGER `post_embeddings_log_update` AFTER UPDATE OF `embedding`, `model` ON `post_embeddings`
BEGIN
	INSERT INTO `embedding_changes`(`sign`, `embedding`, `model`) VALUES (-1, old.`embedding`, old.`model`);
	INSERT INTO `embedding_changes`(`sign`, `embedding`, `model`) VALUES (1, new.`embedding`, new.`model`);
END;
