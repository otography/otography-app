import { createEnv } from "@t3-oss/env-core";
import { type } from "arktype";

export const env = createEnv({
	server: {
		DATABASE_URL: type("string.url"),
		SUPABASE_URL: type("string.url"),
		SUPABASE_PUBLISHABLE_KEY: type("string>0"),
		PORT: type("string.numeric.parse | undefined").pipe((v) => v ?? 3001),
		APP_FRONTEND_URL: type("string.url"),
		NODE_ENV: type("'development' | 'production' | 'test' | undefined").pipe(
			(v) => v ?? "development",
		),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
