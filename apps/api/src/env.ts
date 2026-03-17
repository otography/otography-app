import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.url(),
		SUPABASE_URL: z.url(),
		SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
		PORT: z.coerce.number().default(3001),
		APP_FRONTEND_URL: z.url(),
		NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
