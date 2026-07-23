import { env } from "cloudflare:workers";
import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { AuthError } from "@repo/errors/server";
import type { Database } from "../db";
import {
  verifySessionCookie,
  createSessionCookie,
  verifySessionCookieStrict,
} from "../firebase/firebase-admin";
import { exchangeRefreshToken } from "../firebase/firebase-token-exchange";
import {
  createServerSession,
  getValidSessionByOpaqueId,
  getCurrentSessionById,
  touchSession,
  refreshSessionCredentials,
  revokeSession,
  getSessionsByKeyVersion,
  countSessionsByKeyVersion,
  type ServerSession,
  type SessionCredentials,
} from "./session-repository";
import { encryptCredential, decryptCredential, type AadBinding } from "./envelope";
import type { EncryptCtx } from "./key-ring";

// オペークセッションIDから認証セッションを解決する結果
type ResolvedSession = {
  claims: DecodedIdToken;
  session: ServerSession;
};

// 新規セッション作成用パラメータ
type IssueSessionParams = {
  firebaseIdToken: string;
  firebaseRefreshToken: string;
  userId: string;
  db: Database;
  ctx: EncryptCtx;
};

// セッション発行結果
type IssuedSession = {
  opaqueId: string;
  session: ServerSession;
};

// セッション終端エラーを AuthError に変換（clearCookie 付き）
const terminalSessionError = (message: string, code: string, cause?: unknown): AuthError =>
  new AuthError({
    message,
    code,
    statusCode: 401,
    clearCookie: true,
    problemSlug: "session-invalid",
    ...(cause !== undefined ? { cause } : {}),
  });

// セッションを無効化し、エラーをログに記録する（ベストエフォート）
const safeRevokeSession = async (
  db: Database,
  sessionId: string,
  context: string,
): Promise<void> => {
  const result = await revokeSession(db, sessionId);
  if (result instanceof Error) {
    console.warn(`${context} 後のセッション無効化に失敗しました。`, { message: result.message });
  }
};

// 新しいオペークセッションを発行
export const issueSession = async ({
  firebaseIdToken,
  firebaseRefreshToken,
  userId,
  db,
  ctx,
}: IssueSessionParams): Promise<IssuedSession | Error> => {
  // Firebase セッションクッキーを作成
  const firebaseSessionCookie = await createSessionCookie(firebaseIdToken);
  if (firebaseSessionCookie instanceof Error) return firebaseSessionCookie;

  // オペークIDを生成
  const { generateOpaqueSessionId } = await import("./session-crypto");
  const opaqueId = generateOpaqueSessionId();

  // AADバインディング用のセッションハッシュを事前計算
  const { hashSessionId } = await import("./session-crypto");
  const sessionHash = await hashSessionId(opaqueId);

  const sessionBinding: AadBinding = {
    sessionHash,
    userId,
    purpose: "session",
  };
  const refreshBinding: AadBinding = {
    sessionHash,
    userId,
    purpose: "refresh",
  };

  // クレデンシャルを暗号化
  const encryptedSession = await encryptCredential(ctx, firebaseSessionCookie, sessionBinding);
  if (encryptedSession instanceof Error) return encryptedSession;
  const encryptedRefresh = await encryptCredential(ctx, firebaseRefreshToken, refreshBinding);
  if (encryptedRefresh instanceof Error) return encryptedRefresh;

  const credentials: SessionCredentials = {
    encryptedSessionCredential: encryptedSession,
    encryptedRefreshToken: encryptedRefresh,
    keyVersion: ctx.activeKeyId,
  };

  // DBにセッションを作成
  const session = await createServerSession(db, {
    rawSessionId: opaqueId,
    userId,
    credentials,
  });
  if (session instanceof Error) return session;

  return { opaqueId, session };
};

// オペークセッションIDから認証セッションを解決（検証 + 必要に応じてリフレッシュ）
export const resolveSession = async (
  opaqueId: string,
  db: Database,
  ctx: EncryptCtx,
  checkRevoked: boolean = false,
): Promise<ResolvedSession | null | Error> => {
  const session = await getValidSessionByOpaqueId(db, opaqueId);
  if (session instanceof Error) return session;
  if (session === null) return null;

  // 暗号化クレデンシャルを復号
  const { hashSessionId } = await import("./session-crypto");
  const sessionHash = await hashSessionId(opaqueId);
  const sessionBinding: AadBinding = {
    sessionHash,
    userId: session.userId,
    purpose: "session",
  };
  const refreshBinding: AadBinding = {
    sessionHash,
    userId: session.userId,
    purpose: "refresh",
  };

  // key_version とエンベロープ kid の一貫性を検証（#15）
  if (session.encryptedSessionCredential.kid !== session.encryptedRefreshToken.kid) {
    return terminalSessionError(
      "セッション内のキーIDに不整合があります。",
      "session/key-id-mismatch",
    );
  }

  const sessionCredential = await decryptCredential(
    ctx,
    session.encryptedSessionCredential,
    sessionBinding,
  );
  if (sessionCredential instanceof Error) {
    // 復号失敗 → DBセッションを無効化（#4）
    await safeRevokeSession(db, session.id, "復号失敗");
    return terminalSessionError(
      "セッションクレデンシャルの復号に失敗しました。",
      "session/decrypt-failed",
      sessionCredential,
    );
  }

  const refreshToken = await decryptCredential(ctx, session.encryptedRefreshToken, refreshBinding);
  if (refreshToken instanceof Error) {
    await safeRevokeSession(db, session.id, "リフレッシュトークン復号失敗");
    return terminalSessionError(
      "リフレッシュトークンの復号に失敗しました。",
      "session/decrypt-failed",
      refreshToken,
    );
  }

  // Firebase セッションクッキーを検証
  const verifyFn = checkRevoked ? verifySessionCookieStrict : verifySessionCookie;
  const claims = await verifyFn(sessionCredential);
  if (!(claims instanceof Error)) {
    // 検証成功 → last_used_at を更新（スロットリング付き）
    const touchResult = await touchSession(db, session.id);
    if (touchResult instanceof Error) {
      console.warn("touchSession の更新に失敗しました。", { message: touchResult.message });
    }

    // 遅延再暗号化: エンベロープ kid が古い場合、アクティブキーで再暗号化（#15）
    if (session.encryptedSessionCredential.kid !== ctx.activeKeyId) {
      await lazyReEncrypt(db, session, ctx, sessionCredential, refreshToken, sessionHash);
    }

    return { claims, session };
  }

  // 検証失敗 → リフレッシュを試行
  const refreshedClaims = await refreshFirebaseCredentials(
    db,
    session,
    ctx,
    sessionHash,
    refreshToken,
  );
  if (refreshedClaims instanceof Error) return refreshedClaims;
  if (refreshedClaims === null) return null;

  return { claims: refreshedClaims.claims, session: refreshedClaims.session };
};

// Firebase リフレッシュトークンを使ってクレデンシャルを更新し、DBに原子保存する
const refreshFirebaseCredentials = async (
  db: Database,
  session: ServerSession,
  ctx: EncryptCtx,
  sessionHash: string,
  currentRefreshToken: string,
): Promise<{ claims: DecodedIdToken; session: ServerSession } | null | Error> => {
  // Firebase リフレッシュトークンで新しい ID トークンを取得
  const exchangeResult = await exchangeRefreshToken(env.FIREBASE_API_KEY, currentRefreshToken);
  if (exchangeResult instanceof Error) {
    // リフレッシュ失敗 → セッションを無効化（#4）
    await safeRevokeSession(db, session.id, "リフレッシュ失敗");
    return terminalSessionError(exchangeResult.message, "session/refresh-failed", exchangeResult);
  }

  // 新しいセッションクッキーを作成
  const newSessionCookie = await createSessionCookie(exchangeResult.id_token);
  if (newSessionCookie instanceof Error) {
    await safeRevokeSession(db, session.id, "セッションクッキー作成失敗");
    return newSessionCookie;
  }

  // 新しいクレデンシャルを暗号化
  const sessionBinding: AadBinding = {
    sessionHash,
    userId: session.userId,
    purpose: "session",
  };
  const refreshBinding: AadBinding = {
    sessionHash,
    userId: session.userId,
    purpose: "refresh",
  };

  const encryptedSession = await encryptCredential(ctx, newSessionCookie, sessionBinding);
  if (encryptedSession instanceof Error) {
    await safeRevokeSession(db, session.id, "更新クレデンシャル暗号化失敗");
    return terminalSessionError(
      "更新後のセッションクレデンシャルを保存できませんでした。",
      "session/encrypt-failed",
      encryptedSession,
    );
  }
  const encryptedRefresh = await encryptCredential(
    ctx,
    exchangeResult.refresh_token,
    refreshBinding,
  );
  if (encryptedRefresh instanceof Error) {
    await safeRevokeSession(db, session.id, "更新リフレッシュトークン暗号化失敗");
    return terminalSessionError(
      "更新後のリフレッシュトークンを保存できませんでした。",
      "session/encrypt-failed",
      encryptedRefresh,
    );
  }

  const newCredentials: SessionCredentials = {
    encryptedSessionCredential: encryptedSession,
    encryptedRefreshToken: encryptedRefresh,
    keyVersion: ctx.activeKeyId,
  };

  // 原子更新（楽観的排他制御）
  const updatedSession = await refreshSessionCredentials(
    db,
    session.id,
    session.version,
    newCredentials,
  );
  if (updatedSession instanceof Error) return updatedSession;

  // CAS競合（#5）: 別のリクエストが先に更新した。現在の有効なセッションを再読み込みして返す
  if (updatedSession === null) {
    return recoverFromCasConflict(db, ctx, session, sessionBinding);
  }

  // 検証（checkRevoked=false で十分 — リフレッシュ交換自体が失効チェック済み）
  const claims = await verifySessionCookie(newSessionCookie);
  if (claims instanceof Error) {
    await safeRevokeSession(db, session.id, "リフレッシュ後検証失敗");
    return claims;
  }

  return { claims, session: updatedSession };
};

// CAS競合時に現在の有効なセッションを再読み込みして認証を維持する（#5）
const recoverFromCasConflict = async (
  db: Database,
  ctx: EncryptCtx,
  originalSession: ServerSession,
  sessionBinding: AadBinding,
): Promise<{ claims: DecodedIdToken; session: ServerSession } | null | Error> => {
  // 現在のセッション行を再読み込み
  const current = await getCurrentSessionById(db, originalSession.id);
  if (current instanceof Error) return current;
  const now = Date.now();
  if (
    current === null ||
    current.revokedAt !== null ||
    Date.parse(current.idleExpiresAt) <= now ||
    Date.parse(current.absoluteExpiresAt) <= now
  ) {
    return null;
  }

  // 勝者が暗号化した最新のクレデンシャルを復号
  const sessionCredential = await decryptCredential(
    ctx,
    current.encryptedSessionCredential,
    sessionBinding,
  );
  if (sessionCredential instanceof Error) {
    await safeRevokeSession(db, current.id, "CAS競合回復時復号失敗");
    return terminalSessionError(
      "更新済みセッションクレデンシャルを復号できませんでした。",
      "session/decrypt-failed",
      sessionCredential,
    );
  }

  // 勝者のクレデンシャルを検証
  const claims = await verifySessionCookie(sessionCredential);
  if (claims instanceof Error) {
    await safeRevokeSession(db, current.id, "CAS競合回復時検証失敗");
    return claims;
  }

  return { claims, session: current };
};

// 古いキーで暗号化されたクレデンシャルをアクティブキーで再暗号化（ベストエフォート、エラー伝播 #17）
const lazyReEncrypt = async (
  db: Database,
  session: ServerSession,
  ctx: EncryptCtx,
  plaintextSession: string,
  plaintextRefresh: string,
  sessionHash: string,
): Promise<void> => {
  const sessionBinding: AadBinding = {
    sessionHash,
    userId: session.userId,
    purpose: "session",
  };
  const refreshBinding: AadBinding = {
    sessionHash,
    userId: session.userId,
    purpose: "refresh",
  };

  const reEncryptedSession = await encryptCredential(ctx, plaintextSession, sessionBinding);
  if (reEncryptedSession instanceof Error) {
    console.warn("遅延再暗号化: セッションクレデンシャル暗号化失敗。", {
      message: reEncryptedSession.message,
    });
    return;
  }
  const reEncryptedRefresh = await encryptCredential(ctx, plaintextRefresh, refreshBinding);
  if (reEncryptedRefresh instanceof Error) {
    console.warn("遅延再暗号化: リフレッシュトークン暗号化失敗。", {
      message: reEncryptedRefresh.message,
    });
    return;
  }

  const newCredentials: SessionCredentials = {
    encryptedSessionCredential: reEncryptedSession,
    encryptedRefreshToken: reEncryptedRefresh,
    keyVersion: ctx.activeKeyId,
  };

  const result = await refreshSessionCredentials(db, session.id, session.version, newCredentials);
  if (result instanceof Error) {
    console.warn("遅延再暗号化: DB更新失敗。", { message: result.message });
  }
};

// バッチ再暗号化結果（構造化エラーレポート #16）
type BatchReEncryptResult = {
  reEncrypted: number;
  errors: { sessionId: string; reason: string }[];
};

// バッチ再暗号化（古いキーで暗号化された全アクティブセッションを再暗号化、#16）
export const batchReEncrypt = async (
  db: Database,
  ctx: EncryptCtx,
  oldKeyId: string,
  batchSize: number = 50,
): Promise<BatchReEncryptResult | Error> => {
  const sessions = await getSessionsByKeyVersion(db, oldKeyId, batchSize);
  if (sessions instanceof Error) return sessions;

  const errors: { sessionId: string; reason: string }[] = [];
  let count = 0;

  for (const session of sessions) {
    const sessionBinding: AadBinding = {
      sessionHash: session.sessionHash,
      userId: session.userId,
      purpose: "session",
    };
    const refreshBinding: AadBinding = {
      sessionHash: session.sessionHash,
      userId: session.userId,
      purpose: "refresh",
    };

    // 古いキーで復号
    const plaintextSession = await decryptCredential(
      ctx,
      session.encryptedSessionCredential,
      sessionBinding,
    );
    if (plaintextSession instanceof Error) {
      errors.push({ sessionId: session.id, reason: `復号失敗: ${plaintextSession.message}` });
      continue;
    }
    const plaintextRefresh = await decryptCredential(
      ctx,
      session.encryptedRefreshToken,
      refreshBinding,
    );
    if (plaintextRefresh instanceof Error) {
      errors.push({ sessionId: session.id, reason: `復号失敗: ${plaintextRefresh.message}` });
      continue;
    }

    // アクティブキーで再暗号化
    const reEncryptedSession = await encryptCredential(ctx, plaintextSession, sessionBinding);
    if (reEncryptedSession instanceof Error) {
      errors.push({ sessionId: session.id, reason: `再暗号化失敗: ${reEncryptedSession.message}` });
      continue;
    }
    const reEncryptedRefresh = await encryptCredential(ctx, plaintextRefresh, refreshBinding);
    if (reEncryptedRefresh instanceof Error) {
      errors.push({ sessionId: session.id, reason: `再暗号化失敗: ${reEncryptedRefresh.message}` });
      continue;
    }

    const newCredentials: SessionCredentials = {
      encryptedSessionCredential: reEncryptedSession,
      encryptedRefreshToken: reEncryptedRefresh,
      keyVersion: ctx.activeKeyId,
    };

    // CAS安全更新: 競合時はスキップ（勝者が既に更新済み）
    const result = await refreshSessionCredentials(db, session.id, session.version, newCredentials);
    if (result instanceof Error) {
      errors.push({ sessionId: session.id, reason: `DB更新失敗: ${result.message}` });
      continue;
    }
    if (result === null) {
      // CAS競合: 既に別のリクエストが更新済み（スキップ）
      continue;
    }
    count++;
  }

  return { reEncrypted: count, errors };
};

// 指定キーで残存するアクティブセッション数をカウント（ローテーション完了確認用 #16）
export const countRemainingByKey = async (db: Database, keyId: string): Promise<number | Error> => {
  return countSessionsByKeyVersion(db, keyId);
};
