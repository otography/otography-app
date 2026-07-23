import { createMiddleware } from "hono/factory";
import { AuthError } from "@repo/errors/server";
import { getOpaqueSessionId, clearOpaqueSessionCookie } from "../auth/opaque-cookie";
import { getEncryptCtx } from "../auth/key-ring-loader";
import { resolveSession } from "../auth/session-service";
import { isValidOpaqueCookieValue } from "../auth/session-crypto";
import { respondWithError, unauthorizedResponse } from "../errors/error-response";
import type { Env } from "../types/env";

// 全認証ルートに適用するミドルウェア。
// オペークCookieからサーバーセッションを解決し、authSession に Firebase claims を、
// sessionCtx に解決済みセッションID/ユーザーID/バージョンを設定する。
// 未認証でも next() を呼び出す（オプショナル認証）。
export const authSessionMiddleware = () =>
  createMiddleware<Env>(async (c, next) => {
    c.set("authSession", null);
    c.set("sessionCtx", null);
    c.set("authError", null);

    const opaqueId = getOpaqueSessionId(c);
    if (!opaqueId) {
      await next();
      return;
    }

    // Cookie構文を検証してからDBルックアップ（#8）
    if (!isValidOpaqueCookieValue(opaqueId)) {
      clearOpaqueSessionCookie(c);
      await next();
      return;
    }

    const ctxResult = await getEncryptCtx();
    if (ctxResult instanceof Error) {
      console.error("暗号化コンテキストの初期化に失敗しました。", { message: ctxResult.message });
      c.set("authError", ctxResult);
      await next();
      return;
    }

    const resolved = await resolveSession(opaqueId, c.var.db(), ctxResult);
    if (resolved instanceof Error) {
      // 端末側で回復不能な認証エラーだけCookieを破棄する。
      // DB・鍵管理などの一時障害では再試行可能なCookieを保持する。
      if (resolved instanceof AuthError && resolved.clearCookie) {
        clearOpaqueSessionCookie(c);
      }
      c.set("authError", resolved);
      console.warn("セッション解決に失敗しました。", { message: resolved.message });
      await next();
      return;
    }

    if (resolved === null) {
      // セッションが見つからない、または期限切れ → Cookieをクリア
      clearOpaqueSessionCookie(c);
      await next();
      return;
    }

    // authSession と sessionCtx の両方を設定（#3）
    c.set("authSession", resolved.claims);
    c.set("sessionCtx", {
      sessionId: resolved.session.id,
      userId: resolved.session.userId,
      version: resolved.session.version,
    });
    await next();
  });

// 認証必須ルート用のミドルウェア。
// authSession が設定されていなければ 401 を返す。
export const requireAuthMiddleware = () =>
  createMiddleware<Env>(async (c, next) => {
    if (c.get("authSession")) {
      await next();
      return;
    }
    const authError = c.get("authError");
    if (authError) {
      return respondWithError(authError, c);
    }
    return unauthorizedResponse(c, "You are not logged in.");
  });

// センシティブ操作（アカウント削除など）用の per-route ミドルウェア。
// authSessionMiddleware で解決済みの sessionCtx を使用し、strict モードで再検証する。
// 二重解決を避け、認証バイパスを許さない（#7）。
// requireAuthMiddleware() の後段に配置する。
export const requireFreshSessionMiddleware = () =>
  createMiddleware<Env>(async (c, next) => {
    const authSession = c.get("authSession");
    const sessionCtx = c.get("sessionCtx");

    // authSession がない場合は認証バイパスなし（#7）
    if (!authSession || !sessionCtx) {
      return unauthorizedResponse(c, "You are not logged in.");
    }

    // strict モードでセッションを再検証
    // sessionCtx からセッションIDを取得し、strict verify のみを行う
    const ctxResult = await getEncryptCtx();
    if (ctxResult instanceof Error) {
      console.error("厳格検証用暗号化コンテキストの初期化に失敗しました。");
      return respondWithError(ctxResult, c);
    }

    // strict モードで再解決（checkRevoked = true）
    // セッションが失効・無効化されている場合はエラーまたは null を返す
    const opaqueId = getOpaqueSessionId(c);
    if (!opaqueId) {
      // Cookie がない = sessionCtx がある状態は不整合（認証バイパスなし）
      clearOpaqueSessionCookie(c);
      return unauthorizedResponse(c, "You are not logged in.");
    }

    const resolved = await resolveSession(opaqueId, c.var.db(), ctxResult, true);
    if (resolved instanceof Error) {
      clearOpaqueSessionCookie(c);
      return respondWithError(resolved, c);
    }
    if (resolved === null) {
      clearOpaqueSessionCookie(c);
      return unauthorizedResponse(c, "You are not logged in.");
    }

    await next();
  });
