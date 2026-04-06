/**
 * Drizzle Kit 用の環境変数
 *
 * drizzle-kit コマンド (generate, migrate, push 等) で使用。
 * アプリ本体の env.ts から分離することで、
 * DB 操作に不要なアプリ実行用の環境変数を設定せずに
 * drizzle コマンドを実行可能にする。
 */

interface DrizzleEnv {
  DATABASE_URL: string;
  DATABASE_DIRECT_URL: string;
}

export const env: DrizzleEnv = {
  DATABASE_URL: process.env.DATABASE_URL!,
  DATABASE_DIRECT_URL: process.env.DATABASE_DIRECT_URL!,
};
