import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";
import { generateRandomString } from "better-auth/crypto";
import { oAuthProxy } from "better-auth/plugins";
import { accounts, sessions, users, verifications } from "db";
import { db } from "./db.ts";
import { requireEnv } from "./env.ts";

const PRODUCTION_HOST = "app.otography.workers.dev";
const PRODUCTION_URL = `https://${PRODUCTION_HOST}`;

/** Google が発行したトークンとその期限を NULL にする。 */
const withoutOAuthTokens = <T extends object>(account: T) => ({
  ...account,
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
});

// 初期化の CPU 時間をリクエストごとに使わないよう、モジュールの最上位で 1 回だけ作る。
// BETTER_AUTH_SECRET は、Better Auth が process.env から読む。
export const auth = betterAuth({
  // アプリの URL は、リクエストのホスト名から決める。ホスト名が allowedHosts に無ければ fallback を使う。
  // 本番（app）、Preview（<Preview 名>-app）、ローカル（Vite の開発サーバー）の URL がそれぞれ違うため。
  baseURL: {
    allowedHosts: [PRODUCTION_HOST, "*-app.otography.workers.dev", "localhost:3000"],
    fallback: PRODUCTION_URL,
  },
  // Preview の URL は Preview ごとに変わるが、Google にはリダイレクト URI を完全一致で登録する必要がある。
  // そこで Preview のログインは本番を経由させ、Google には本番の URI だけを登録する（ADR 0008）。
  // OAUTH_PROXY_SECRET を設定した環境（本番と Preview）だけで有効にする。ローカルは自分の URI で直接ログインする。
  plugins: process.env.OAUTH_PROXY_SECRET
    ? [oAuthProxy({ productionURL: PRODUCTION_URL, secret: process.env.OAUTH_PROXY_SECRET })]
    : [],
  database: drizzleAdapter(db, {
    provider: "sqlite",
    usePlural: true,
    schema: { users, sessions, accounts, verifications },
  }),
  // パスワードのハッシュ計算は Workers の CPU 制限（10ms）を超えるおそれがあるので、Google だけにする。
  socialProviders: {
    google: {
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    },
  },
  user: {
    additionalFields: {
      // URL に使う ID。登録時にランダムな値を入れ、その後は変えない。
      publicId: {
        type: "string",
        required: true,
        input: false,
        defaultValue: () => generateRandomString(12, "a-z", "0-9"),
      },
      bio: { type: "string", required: false, input: false },
      suspendedAt: { type: "date", required: false, input: false },
      deletedAt: { type: "date", required: false, input: false },
    },
  },
  account: {
    // Google のトークンは保存しない（databaseHooks.account を参照）。ログインのたびに account の行を更新する必要も無い。
    updateAccountOnSignIn: false,
  },
  session: {
    // セッションの確認のたびに DB を読まないよう、署名付きのクッキーに 5 分間保存する。
    // そのため、ログアウトや利用停止が他の端末に反映されるまで最大 5 分かかる。
    cookieCache: { enabled: true, maxAge: 5 * 60, strategy: "compact" },
  },
  databaseHooks: {
    // ログインの後に Google の API を使わないので、Google が発行したトークンを DB に保存しない。
    // DB の中身が漏れても、Google のアカウントに使えるトークンが含まれないようにする。
    account: {
      create: { before: async (account) => ({ data: withoutOAuthTokens(account) }) },
      update: { before: async (account) => ({ data: withoutOAuthTokens(account) }) },
    },
    session: {
      create: {
        // 利用停止中・退会済みのユーザーにはセッションを作らない（ログインを拒否する）。
        before: async (session) => {
          const user = await db.query.users.findFirst({
            where: { id: session.userId },
            columns: { suspendedAt: true, deletedAt: true },
          });
          if (!user || user.suspendedAt || user.deletedAt) return false;
        },
      },
    },
  },
  advanced: {
    // Workers へのリクエストには X-Forwarded-For が付かないので、利用者の IP は CF-Connecting-IP から読む。
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
  },
});

export type Auth = typeof auth;
