import { env } from "cloudflare:workers";
import { SignJWT, importPKCS8 } from "jose";
import { AppleMusicError } from "@repo/errors";

// 秘密鍵は初回のみパース（不変なためモジュール変数に保持して問題ない）
// Promise 自体をキャッシュして同時リクエストでの二重パースを防ぐ
let privateKeyPromise: ReturnType<typeof importPKCS8> | null = null;

const getPrivateKey = () => {
  if (!privateKeyPromise) {
    const rawKey = env.APPLE_PRIVATE_KEY;
    const pemKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
    privateKeyPromise = importPKCS8(pemKey, "ES256");
  }
  return privateKeyPromise;
};

// 内部共通の署名関数 — TTL と origin クレームをオプションで受け取る
// origins は空配列でも truthy になるため length で判定する
const signDeveloperToken = (opts: { ttlSeconds: number; origin?: string[] }): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  return getPrivateKey().then((key) => {
    const builder = new SignJWT(opts.origin?.length ? { origin: opts.origin } : {})
      .setProtectedHeader({ alg: "ES256", kid: env.APPLE_KEY_ID })
      .setIssuer(env.APPLE_TEAM_ID)
      .setIssuedAt(now)
      .setExpirationTime(now + opts.ttlSeconds);
    return builder.sign(key);
  });
};

// サーバー内部利用（client.ts）: 24h・origin なし — 現行と完全同一
export const generateDeveloperToken = () => signDeveloperToken({ ttlSeconds: 60 * 60 * 24 });

// Web 配布用（MusicKit JS）: 1h・origin クレームで利用元を制限
// origins が空の場合は fail-closed でエラーを返す（origin 制限のないトークンを発行しない）
// message は formatErrorResponse 経由で RFC 9457 detail として露出するため、
// 内部設定（環境変数名や設定状態）を含めない安定したユーザー向けメッセージにする。
// 内部デバッグ情報は cause にのみ保持し、detail に結合しない。
export const generateWebDeveloperToken = (origins: string[]): Promise<string | AppleMusicError> => {
  if (origins.length === 0) {
    return Promise.resolve(
      new AppleMusicError({
        message: "Apple Music developer token could not be issued. Please try again later.",
        statusCode: 500,
        problemSlug: "internal-error",
        cause: "APP_FRONTEND_URL is not configured; cannot issue a web developer token.",
      }),
    );
  }
  return signDeveloperToken({ ttlSeconds: 60 * 60, origin: origins });
};
