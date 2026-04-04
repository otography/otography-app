import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
		}),
	],
	test: {
		globals: true,
		include: ["src/**/*.test.ts"],
		setupFiles: ["./src/__tests__/setup.ts"],
	},
});
