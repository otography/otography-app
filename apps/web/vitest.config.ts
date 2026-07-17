import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";
import { transform } from "@stylexswc/rs-compiler";

const stylexPlugin = (): Plugin => ({
  name: "stylex-transform",
  enforce: "pre",
  transform(code, id) {
    if (!/\.[tj]sx?$/.test(id) || /node_modules/.test(id)) return null;
    if (!/(stylex\.create|defineVars|defineConsts|createTheme)/.test(code)) return null;
    try {
      const result = transform(id, code, {
        dev: true,
        unstable_moduleResolution: { type: "commonJS", rootDir: path.resolve(__dirname, "src") },
        aliases: {
          "@/*": [path.resolve(__dirname, "src/*")],
        },
      });
      return { code: result.code, map: result.map };
    } catch (e) {
      console.error(`[stylex] transform error in ${id}:`, e);
      return null;
    }
  },
});

export default defineConfig({
  plugins: [stylexPlugin(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
