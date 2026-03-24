import { createEnv } from "@t3-oss/env-core";
import { type } from "arktype";

/**
 * Drizzle Kit 用の環境変数
 *
 * drizzle-kit コマンド (generate, migrate, push 等) で使用。
 * アプリ本体の env.ts から分離することで、
 * DB 操作に不要なアプリ実行用の環境変数を設定せずに
 * drizzle コマンドを実行可能にする。
 */
export const env = createEnv({
	server: {
		DATABASE_URL: type("string.url"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
