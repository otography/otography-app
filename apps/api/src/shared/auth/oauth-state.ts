import * as jose from "jose";
import { OAuthStateError } from "@repo/errors";

// OAuth state JWTの設定
const STATE_JWT_ALG = "HS256";
const STATE_EXPIRY_SECONDS = 300; // 5分

export type OAuthStatePayload = {
  nonce: string;
  iat: number;
  exp: number;
  redirect: string;
  from?: string;
};

/** OAuth state用のnonceを保持するcookie名 */
export const OAUTH_NONCE_COOKIE_NAME = "__Host-otography_oauth_nonce";

type GeneratedOAuthState = {
  nonce: string;
  token: string;
};

/**
 * OAuth state用の署名済みJWTを生成する。
 * CSRF対策として機能し、リダイレクト先URLを保持する。
 *
 * @param secret - HMAC-SHA256署名用のシークレット（AUTH_OAUTH_STATE_SECRET）
 * @param redirect - 認証完了後のリダイレクト先（デフォルト: /account）
 * @param from - OAuth エラー時のリダイレクト先（デフォルト: /login）
 * @returns nonceと署名済みJWT文字列、または Error
 */
export const generateOAuthState = async (
  secret: string,
  redirect?: string,
  from?: string,
): Promise<OAuthStateError | GeneratedOAuthState> => {
  const secretKey = new TextEncoder().encode(secret);
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();

  const payload: Record<string, unknown> = {
    nonce,
    redirect: redirect ?? "/account",
  };
  if (from) {
    payload.from = from;
  }

  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: STATE_JWT_ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + STATE_EXPIRY_SECONDS)
    .sign(secretKey)
    .catch(
      (e) => new OAuthStateError({ message: "Failed to generate OAuth state JWT.", cause: e }),
    );

  if (jwt instanceof Error) return jwt;

  return { nonce, token: jwt };
};

/**
 * OAuth state JWTを検証し、デコードされたペイロードを返す。
 *
 * @param secret - HMAC-SHA256検証用のシークレット（AUTH_OAUTH_STATE_SECRET）
 * @param token - 検証対象のJWT文字列
 * @returns デコードされたペイロード、または Error
 */
export const verifyOAuthState = async (
  secret: string,
  token: string,
): Promise<OAuthStateError | OAuthStatePayload> => {
  const secretKey = new TextEncoder().encode(secret);

  const result = await jose
    .jwtVerify(token, secretKey, { algorithms: [STATE_JWT_ALG] })
    .catch(
      (e) => new OAuthStateError({ message: "Invalid or expired OAuth state token.", cause: e }),
    );

  if (result instanceof Error) return result;

  // ペイロードの実行時検証 — 署名が有効でもクレーム欠落・型不一致を防ぐ
  const { nonce, iat, exp, redirect, from } = result.payload;
  if (
    typeof nonce !== "string" ||
    typeof iat !== "number" ||
    typeof exp !== "number" ||
    typeof redirect !== "string"
  ) {
    return new OAuthStateError({ message: "OAuth state token contains invalid claims." });
  }

  const payload: OAuthStatePayload = { nonce, iat, exp, redirect };
  if (from !== undefined) {
    if (typeof from !== "string") {
      return new OAuthStateError({ message: "OAuth state token contains invalid claims." });
    }
    payload.from = from;
  }

  return payload;
};
