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
};

/**
 * OAuth state用の署名済みJWTを生成する。
 * CSRF対策として機能し、リダイレクト先URLを保持する。
 *
 * @param secret - HMAC-SHA256署名用のシークレット（AUTH_OAUTH_STATE_SECRET）
 * @param redirect - 認証完了後のリダイレクト先（デフォルト: /account）
 * @returns 署名済みJWT文字列、または Error
 */
export const generateOAuthState = async (
  secret: string,
  redirect?: string,
): Promise<OAuthStateError | string> => {
  const secretKey = new TextEncoder().encode(secret);
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new jose.SignJWT({
    nonce: crypto.randomUUID(),
    redirect: redirect ?? "/account",
  })
    .setProtectedHeader({ alg: STATE_JWT_ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + STATE_EXPIRY_SECONDS)
    .sign(secretKey)
    .catch(
      (e) => new OAuthStateError({ message: "Failed to generate OAuth state JWT.", cause: e }),
    );

  return jwt;
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

  return {
    nonce: result.payload.nonce as string,
    iat: result.payload.iat as number,
    exp: result.payload.exp as number,
    redirect: result.payload.redirect as string,
  };
};
