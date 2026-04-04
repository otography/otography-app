import { defineConfig } from "drizzle-kit";
import { env } from "./src/env.drizzle";

export default defineConfig({
	schema: "./src/shared/db/schema.ts",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: env.DATABASE_DIRECT_URL,
	},
});
