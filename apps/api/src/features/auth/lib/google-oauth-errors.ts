import {
  AccountConflictError,
  FirebaseIdpSigninError,
  GoogleTokenExchangeError,
  type OAuthStateError,
} from "@repo/errors";
import { AuthError } from "@repo/errors/server";

/**
 * state JWTの検証エラーから適切なエラーコードを判定する。
 * ラップされた元エラー（cause）の型・nameを確認し、
 * 期限切れと明確に判定できる場合のみ expired_state を返す。
 */
const isExpiredError = (value: unknown): boolean => {
  if (!(value instanceof Error)) return false;
  return (
    value.name === "JWTExpired" || (value as Error & { code?: string }).code === "ERR_JWT_EXPIRED"
  );
};

export const getStateErrorCode = (error: OAuthStateError): string => {
  if (isExpiredError(error.cause) || isExpiredError(error)) {
    return "expired_state";
  }
  return "invalid_state";
};

/**
 * 外部サービス・セッション発行エラーから適切なエラーコードへのマッピング。
 * エラーの型（instanceof）に基づいて一意に決定する。
 * AuthError（ユーザーレコード作成・暗号化コンテキスト取得・セッション発行の失敗）は
 * すべて session_failed に集約する（usecase/oauth-signin.ts のオーケストレーション結果）。
 */
export const getOAuthErrorCode = (error: Error): string => {
  if (error instanceof AccountConflictError) return "account_exists";
  if (error instanceof GoogleTokenExchangeError) return "oauth_failed";
  if (error instanceof FirebaseIdpSigninError) return "firebase_auth_failed";
  if (error instanceof AuthError) return "session_failed";
  return "oauth_failed";
};
