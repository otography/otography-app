import { createEnv } from "@t3-oss/env-nextjs";
import { type } from "arktype";

export const env = createEnv({
	server: {},
	client: {
		NEXT_PUBLIC_SUPABASE_URL: type("string.url"),
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: type("string>0"),
		NEXT_PUBLIC_API_URL: type("string.url"),
	},
	experimental__runtimeEnv: {
		NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
	},
	emptyStringAsUndefined: true,
	skipValidation: !!process.env.CI,
});
