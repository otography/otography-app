import { fileURLToPath } from "node:url";
import { defineConfig, lazyPlugins } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackRouter } from "@tanstack/router-plugin/vite";

import viteReact from "@vitejs/plugin-react";
import stylex from "@stylexjs/unplugin";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(() => [
    devtools(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    // StyleX のドキュメントに従い、Fast Refresh を保つため @vitejs/plugin-react より前に置く。
    // useCSSLayers：StyleX が出力する CSS を @layer に入れ、後から書く CSS の詳細度と競合させない。
    // aliases：package.json の imports（#/*）を StyleX にも教える。StyleX は defineVars のファイルを自分で解決するため。
    stylex.vite({
      useCSSLayers: true,
      aliases: { "#/*": [fileURLToPath(new URL("./src/*", import.meta.url))] },
    }),
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
