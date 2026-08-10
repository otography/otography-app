import type { Database } from "../db";
import {
  refreshSessionCredentials,
  getSessionsByKeyVersion,
  type ServerSession,
  type SessionCredentials,
} from "./session-repository";
import { encryptCredential, decryptCredential, type AadBinding } from "./envelope";
import type { EncryptCtx } from "./key-ring";

// 古いキーで暗号化されたクレデンシャルをアクティブキーで再暗号化（ベストエフォート、エラー伝播 #17）
export const lazyReEncrypt = async (
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
