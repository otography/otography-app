import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { AuthRestError } from "@repo/errors";
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
const parseKeyHex = (hex: string): ArrayBuffer => {
  if (hex.length !== 64 || !HEX_REGEX.test(hex)) {
    throw new Error(
      "AUTH_ENCRYPTION_KEY must be a 64-character hex string (32 bytes for AES-256).",
    );
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
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

const encrypt = async (plaintext: string, keyHex: string): Promise<string> => {
  const keyBytes = parseKeyHex(keyHex);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
  ]);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer },
    key,
    encoded.buffer,
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return bytesToHex(combined);
};

const decrypt = async (encryptedHex: string, keyHex: string): Promise<string> => {
  const keyBytes = parseKeyHex(keyHex);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);

  const combined = hexToBytes(encryptedHex);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer },
    key,
    ciphertext.buffer,
  );

  return new TextDecoder().decode(decrypted);
};

export const getRefreshTokenCookie = async (c: Context): Promise<string | null> => {
  const encrypted = getCookie(c, REFRESH_TOKEN_COOKIE_NAME) ?? null;
  if (!encrypted) return null;

  try {
    return await decrypt(encrypted, c.env.AUTH_ENCRYPTION_KEY);
  } catch {
    // 復号に失敗した場合はCookieが改ざんされているかキーが変更された
    clearRefreshTokenCookie(c);
    return null;
  }
};

export const setRefreshTokenCookie = async (
  c: Context,
  refreshToken: string,
): Promise<AuthRestError | void> => {
  const encrypted = await encrypt(refreshToken, c.env.AUTH_ENCRYPTION_KEY).catch(
    (e) =>
      new AuthRestError({
        message: "Failed to set refresh token cookie.",
        statusCode: 500,
        cause: e,
      }),
  );
  if (encrypted instanceof Error) return encrypted;
  setCookie(c, REFRESH_TOKEN_COOKIE_NAME, encrypted, createRefreshTokenCookieOptions(c));
};

export const clearRefreshTokenCookie = (c: Context) => {
  deleteCookie(c, REFRESH_TOKEN_COOKIE_NAME, {
    domain: c.env.AUTH_COOKIE_DOMAIN || undefined,
    path: "/",
  });
};
