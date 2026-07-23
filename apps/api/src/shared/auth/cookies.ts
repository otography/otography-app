// 本番環境（HTTPS）で使用する __Host- プレフィックス付きセッションCookie名
const HOST_PREFIXED_SESSION_COOKIE_NAME = "__Host-otography_session";
// 開発環境（localhost HTTP）で使用するセッションCookie名
const DEV_SESSION_COOKIE_NAME = "otography_session";

export const OAUTH_NONCE_COOKIE_NAME = "otography_oauth_nonce";

// リクエストがHTTPSかどうかでCookie名を切り替える
export const getSessionCookieName = (isSecure: boolean): string =>
  isSecure ? HOST_PREFIXED_SESSION_COOKIE_NAME : DEV_SESSION_COOKIE_NAME;
