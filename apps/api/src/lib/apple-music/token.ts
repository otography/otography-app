import { SignJWT, importPKCS8 } from "jose";
import { requireEnv } from "../env.ts";
import { DeveloperTokenError } from "./errors.ts";
import { normalizePkcs8Pem } from "./private-key.ts";

// 開発者トークンの作り方は docs/adr/0010-sign-apple-music-developer-token-in-worker.md を参照。
const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60;
const RENEW_BEFORE_SECONDS = 60 * 60;

const teamId = requireEnv("APPLE_TEAM_ID");
const keyId = requireEnv("APPLE_KEY_ID");
const privateKeyPem = normalizePkcs8Pem(requireEnv("APPLE_MUSIC_PRIVATE_KEY"));

export type DeveloperToken = { token: string; expiresAt: number };

// 鍵の読み込みは非同期なので、最初に使うときに 1 回だけ行う。
let privateKey: Promise<DeveloperTokenError | CryptoKey> | null = null;
const loadPrivateKey = () => {
  privateKey ??= importPKCS8(privateKeyPem, "ES256").catch(
    (error: unknown) => new DeveloperTokenError({ cause: error }),
  );
  return privateKey;
};

// キーはトークンの origin クレーム。Worker から Apple を呼ぶ用のトークンは空文字列。
const cache = new Map<string, DeveloperToken>();

/**
 * Apple Music API の開発者トークンを返す。
 * origin を渡すと、そのオリジンのブラウザからだけ使えるトークンになる（MusicKit JS 用）。
 */
export async function getDeveloperToken({ origin }: { origin: string | null }) {
  const now = Math.floor(Date.now() / 1000);
  const cached = cache.get(origin ?? "");
  if (cached && cached.expiresAt - now > RENEW_BEFORE_SECONDS) {
    return cached;
  }

  const key = await loadPrivateKey();
  if (key instanceof Error) {
    return key;
  }

  const expiresAt = now + TOKEN_LIFETIME_SECONDS;
  const token = await new SignJWT(origin ? { origin: [origin] } : {})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(key)
    .catch((error: unknown) => new DeveloperTokenError({ cause: error }));
  if (token instanceof Error) {
    return token;
  }

  const entry = { token, expiresAt };
  cache.set(origin ?? "", entry);
  return entry;
}
