import { defineConfig } from "oxlint";

/**
 * A shared Oxlint configuration for the repository.
 * Includes default plugins: eslint, typescript, unicorn, oxc
 */
export default defineConfig({
	plugins: ["eslint", "typescript", "unicorn", "oxc"],
});
