import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

// シークレットの値は、ローカルでは .env に書き、デプロイ先ではシークレットとして登録する（.env.example を参照）。
// secret() を 1 つでも宣言すると、ここで宣言していない .env の値は Worker に渡らない。
export default defineConfig(({ isPreview, mode }) => ({
  worker: {
    name: !isPreview ? "otography" : "otography-preview",
    compatibilityDate: "2026-11-13",
    entrypoint,
    env: {
      // ブラウザから見たアプリの URL。ローカルでは Vite（apps/website）の開発サーバーを通すので 3000 番。
      // デプロイ先の URL は、workers.dev の URL が決まった時点でここに書く。
      ...(mode === "development" && { BETTER_AUTH_URL: bindings.text("http://localhost:3000") }),
      BETTER_AUTH_SECRET: bindings.secret(),
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
      TURSO_DATABASE_URL: bindings.secret(),
      TURSO_AUTH_TOKEN: bindings.secret(),
    },
  },
}));
