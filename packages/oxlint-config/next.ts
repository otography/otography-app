import baseConfig from "./base.ts";
import { defineConfig } from "oxlint";

/**
 * A custom Oxlint configuration for Next.js applications.
 */
export default defineConfig({
	extends: [baseConfig],
	plugins: ["react", "react-perf", "nextjs", "promise", "jsdoc"],
	categories: {
		correctness: "error",
		suspicious: "warn",
	},
	rules: {
		"react-in-jsx-scope": "off",
	},
	ignorePatterns: [".next/**", "out/**", "build/**", "next-env.d.ts", "dist/**"],
});
