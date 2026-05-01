import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { AuthRestError, RefreshTokenCookieError } from "@repo/errors";
import { SESSION_COOKIE_MAX_AGE_MS } from "./session-cookie";

const REFRESH_TOKEN_COOKIE_NAME = "otography_refresh_token";

// refresh token cookieはセッションcookieより長く保持し、
// セッション失効後も自動リフレッシュできるようにする
const REFRESH_TOKEN_COOKIE_MAX_AGE_S = (SESSION_COOKIE_MAX_AGE_MS / 1000) * 2;

const createRefreshTokenCookieOptions = (c: Context) => {
  return {
    domain: c.env.AUTH_COOKIE_DOMAIN || undefined,
    httpOnly: true,
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_S,
    path: "/",
    sameSite: "Lax" as const,
    secure: new URL(c.req.url).protocol === "https:",
  };
};

const HEX_REGEX = /^[0-9a-fA-F]+$/;

// AES-256鍵用: 64文字(32byte)固定
const parseKeyHex = (hex: string) => {
  if (hex.length !== 64 || !HEX_REGEX.test(hex)) {
    return new RefreshTokenCookieError({
      message: "AUTH_ENCRYPTION_KEY must be a 64-character hex string (32 bytes for AES-256).",
    });
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
};

// プロセス単位でCryptoKeyをキャッシュし、毎回のparseKeyHex + importKeyを回避する
const cryptoKeyCache = new Map<string, CryptoKey>();

const getCryptoKey = async (keyHex: string) => {
  const cached = cryptoKeyCache.get(keyHex);
  if (cached) return cached;

  const keyBytes = parseKeyHex(keyHex);
  if (keyBytes instanceof Error) return keyBytes;

  const key = await crypto.subtle
    .importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
    .catch(
      (e) =>
        new RefreshTokenCookieError({ message: "Failed to import refresh token key.", cause: e }),
    );
  if (key instanceof Error) return key;

  cryptoKeyCache.set(keyHex, key);
  return key;
};

// 暗号文用: 可変長hex
const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
};

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const encrypt = async (plaintext: string, keyHex: string) => {
  const key = await getCryptoKey(keyHex);
  if (key instanceof Error) return key;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle
    .encrypt({ name: "AES-GCM", iv: iv.buffer }, key, encoded.buffer)
    .catch(
      (e) => new RefreshTokenCookieError({ message: "Failed to encrypt refresh token.", cause: e }),
    );
  if (ciphertext instanceof Error) return ciphertext;

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return bytesToHex(combined);
};

const decrypt = async (encryptedHex: string, keyHex: string) => {
  const key = await getCryptoKey(keyHex);
  if (key instanceof Error) return key;

  const combined = hexToBytes(encryptedHex);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle
    .decrypt({ name: "AES-GCM", iv: iv.buffer }, key, ciphertext.buffer)
    .catch(
      (e) => new RefreshTokenCookieError({ message: "Failed to decrypt refresh token.", cause: e }),
    );
  if (decrypted instanceof Error) return decrypted;

  return new TextDecoder().decode(decrypted);
};

export const getRefreshTokenCookie = async (c: Context): Promise<string | null> => {
  const encrypted = getCookie(c, REFRESH_TOKEN_COOKIE_NAME) ?? null;
  if (!encrypted) return null;

  const refreshToken = await decrypt(encrypted, c.env.AUTH_ENCRYPTION_KEY);
  if (refreshToken instanceof Error) {
    // 復号に失敗した場合はCookieが改ざんされているかキーが変更された
    console.warn("Failed to decrypt refresh token cookie:", refreshToken.message);
    clearRefreshTokenCookie(c);
    return null;
  }

  return refreshToken;
};

export const setRefreshTokenCookie = async (
  c: Context,
  refreshToken: string,
): Promise<AuthRestError | void> => {
  const encrypted = await encrypt(refreshToken, c.env.AUTH_ENCRYPTION_KEY);
  if (encrypted instanceof Error) {
    return new AuthRestError({
      message: "Failed to set refresh token cookie.",
      statusCode: 500,
      cause: encrypted,
    });
  }
  setCookie(c, REFRESH_TOKEN_COOKIE_NAME, encrypted, createRefreshTokenCookieOptions(c));
};

export const clearRefreshTokenCookie = (c: Context) => {
  deleteCookie(c, REFRESH_TOKEN_COOKIE_NAME, {
    domain: c.env.AUTH_COOKIE_DOMAIN || undefined,
    path: "/",
  });
};
