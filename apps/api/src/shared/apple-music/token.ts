import { env } from "cloudflare:workers";
import { SignJWT, importPKCS8 } from "jose";

// キャッシュ済み developer token（24h 有効）
let cachedToken: string | null = null;
let cachedTokenExp: number = 0;

// Apple Music API 用の developer token を生成（キャッシュ付き）
// 環境変数の \\n を実際の改行に変換してから importPKCS8 に渡す
export const generateDeveloperToken = async (): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);

  // 1時間以上残っている場合はキャッシュを再利用
  if (cachedToken && cachedTokenExp > now + 3600) {
    return cachedToken;
  }

  const rawKey = env.APPLE_MUSIC_PRIVATE_KEY;
  const pemKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  const privateKey = await importPKCS8(pemKey, "ES256");

  const exp = now + 60 * 60 * 24;
  cachedToken = await new SignJWT({
    iss: env.APPLE_TEAM_ID,
    iat: now,
    exp,
  })
    .setProtectedHeader({ alg: "ES256", kid: env.APPLE_KEY_ID })
    .sign(privateKey);

  cachedTokenExp = exp;
  return cachedToken;
};
