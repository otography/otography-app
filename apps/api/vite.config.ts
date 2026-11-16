import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  plugins: lazyPlugins(() => [cloudflare()]),
  // apps/website のビルド成果物を静的アセットとして取り込み、1 つの Worker で配信する。
  // 先に apps/website をビルドしておく必要がある（package.json の build、deploy、deploy:staging を参照）。
  publicDir: "../website/dist",
  server: { port: 8787 },
});
