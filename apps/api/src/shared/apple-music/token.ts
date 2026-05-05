import { env } from "cloudflare:workers";
import { SignJWT, importPKCS8 } from "jose";

const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24h

// 秘密鍵は初回のみパース（不変なためモジュール変数に保持して問題ない）
// Promise 自体をキャッシュして同時リクエストでの二重パースを防ぐ
let privateKeyPromise: ReturnType<typeof importPKCS8> | null = null;

const getPrivateKey = () => {
  if (!privateKeyPromise) {
    const rawKey = env.APPLE_MUSIC_PRIVATE_KEY;
    const pemKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
    privateKeyPromise = importPKCS8(pemKey, "ES256");
  }
  return privateKeyPromise;
};

// キャッシュなし: 毎リクエスト生成。レスポンスのキャッシュはroute側でHono/cacheに任せる
export const generateDeveloperToken = () => {
  const now = Math.floor(Date.now() / 1000);
  return getPrivateKey().then((key) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: env.APPLE_KEY_ID })
      .setIssuer(env.APPLE_TEAM_ID)
      .setIssuedAt(now)
      .setExpirationTime(now + TOKEN_TTL_SECONDS)
      .sign(key),
  );
};
