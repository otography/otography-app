import { defineConfig, lazyPlugins } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackRouter } from "@tanstack/router-plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(() => [
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    viteReact(),
  ]),
  server: {
    proxy: {
      // Host ヘッダーを書き換えない（localhost:3000 のまま API に渡す）。
      // API の Better Auth は、Host からアプリの URL を決めるため（apps/api/src/auth/auth.ts の baseURL）。
      "/api": { target: "http://localhost:8787", changeOrigin: false },
    },
  },
});

export default config;
