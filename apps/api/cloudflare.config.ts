import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

// Worker は本番の 1 つだけにし、ステージングはその Worker の Preview（名前は staging）として作る。
// workers.dev の URL は <Worker 名>.otography.workers.dev、Preview は <Preview 名>-<Worker 名>.otography.workers.dev になる。
const WORKER_NAME = "app";

// シークレットの値は、ローカルでは .env に書き、デプロイ先ではシークレットとして登録する（.env.example を参照）。
// secret() を 1 つでも宣言すると、ここで宣言していない .env の値は Worker に渡らない。
export default defineConfig(() => ({
  worker: {
    name: WORKER_NAME,
    compatibilityDate: "2026-11-13",
    entrypoint,
    // 画面の URL（/、/search など）は SPA の index.html を返し、/api/* だけを Worker で処理する。
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: ["/api/*"],
    },
    // Workers Logs に呼び出しごとの記録（CPU 時間を含む）を残す。
    // OAuth のコールバックの URL には認可コードが入るので、クエリ文字列は記録しない。
    observability: { enabled: true, redactQueryString: true },
    env: {
      BETTER_AUTH_SECRET: bindings.secret(),
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
      TURSO_DATABASE_URL: bindings.secret(),
      TURSO_AUTH_TOKEN: bindings.secret(),
      // 本番と Preview で同じ値にする。ローカルでは設定しない（apps/api/src/auth.ts の plugins を参照）
      OAUTH_PROXY_SECRET: bindings.secret(),
      // Apple Music API の開発者トークンを署名する鍵（Media Services を有効にした鍵）
      APPLE_TEAM_ID: bindings.secret(),
      APPLE_KEY_ID: bindings.secret(),
      APPLE_MUSIC_PRIVATE_KEY: bindings.secret(),
    },
  },
}));
