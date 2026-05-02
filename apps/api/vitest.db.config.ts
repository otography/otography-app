import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.db.test.ts"],
    globalSetup: ["./src/__tests__/setup-db.ts"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
