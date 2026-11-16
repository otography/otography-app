import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";
import { generateRandomString } from "better-auth/crypto";
import { accounts, sessions, users, verifications } from "db";
import { db } from "./db.ts";
import { requireEnv } from "./env.ts";

// 初期化の CPU 時間をリクエストごとに使わないよう、モジュールの最上位で 1 回だけ作る。
// BETTER_AUTH_SECRET と BETTER_AUTH_URL は、Better Auth が process.env から読む。
export const auth = betterAuth({
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
  session: {
    // セッションの確認のたびに DB を読まないよう、署名付きのクッキーに 5 分間保存する。
    // そのため、ログアウトや利用停止が他の端末に反映されるまで最大 5 分かかる。
    cookieCache: { enabled: true, maxAge: 5 * 60, strategy: "compact" },
  },
  databaseHooks: {
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
