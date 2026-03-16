import baseConfig from "./base.ts";
import { defineConfig } from "oxlint";

/**
 * A custom Oxlint configuration for Node.js backends.
 */
export default defineConfig({
	extends: [baseConfig],
	plugins: ["import", "node"],
});
