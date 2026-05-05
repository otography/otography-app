import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.db.test.ts"],
    globalSetup: ["./src/__tests__/helpers/db/setup.ts"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    // 全テストファイルが同じDBを共有するため、並列実行すると TRUNCATE でデッドロックが発生する
    isolate: false,
    fileParallelism: false,
  },
});
