import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as errore from "errore";

class OAuthConfigError extends errore.createTaggedError({
  name: "OAuthConfigError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 500;
}

class OAuthStateError extends errore.createTaggedError({
  name: "OAuthStateError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 400;
}

class OAuthExchangeError extends errore.createTaggedError({
  name: "OAuthExchangeError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 502;
}

// Google OAuth トークン交換失敗（oauth2.googleapis.com/token）
class GoogleTokenExchangeError extends errore.createTaggedError({
  name: "GoogleTokenExchangeError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 502;
}

// Firebase signInWithIdp 失敗
class FirebaseIdpSigninError extends errore.createTaggedError({
  name: "FirebaseIdpSigninError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 502;
}

// 同一メールアドレスが別プロバイダーで既に登録済み（needConfirmation）
class AccountConflictError extends errore.createTaggedError({
  name: "AccountConflictError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 409;
}

export {
  AccountConflictError,
  FirebaseIdpSigninError,
  GoogleTokenExchangeError,
  OAuthConfigError,
  OAuthExchangeError,
  OAuthStateError,
};
