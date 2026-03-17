import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {},
	client: {
		NEXT_PUBLIC_SUPABASE_URL: z.url(),
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
		NEXT_PUBLIC_API_URL: z.url(),
	},
	experimental__runtimeEnv: {
		NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
	},
	emptyStringAsUndefined: true,
	skipValidation: !!process.env.CI,
});
