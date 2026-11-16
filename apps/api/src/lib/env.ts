/**
 * 必須の環境変数を読む。値が無い場合は、起動時に分かるように例外を投げる。
 * Workers では、互換日付が 2025-04-01 以降であれば、変数とシークレットが process.env に入る。
 */
export const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`環境変数 ${name} が設定されていません`);
  return value;
};
