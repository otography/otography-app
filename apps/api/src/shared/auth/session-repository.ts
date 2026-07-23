import * as errore from "errore";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { serverSessions } from "../db/schema";
import type { DatabaseOrTransaction } from "../db";
import { validateEnvelope, type CredentialEnvelope } from "./envelope";
import { hashSessionId } from "./session-crypto";
import {
  ABSOLUTE_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  LAST_USED_UPDATE_INTERVAL_MS,
} from "./session-config";

// セッションリポジトリエラー（DB操作のラップ用）
class SessionRepoError extends errore.createTaggedError({
  name: "SessionRepoError",
  message: "$message",
}) {
  statusCode: number = 500;
}

// セッション作成時に保存する暗号化クレデンシャル
export type SessionCredentials = {
  encryptedSessionCredential: CredentialEnvelope;
  encryptedRefreshToken: CredentialEnvelope;
  keyVersion: string;
};

// セッション読み取り結果
export type ServerSession = {
  id: string;
  userId: string;
  encryptedSessionCredential: CredentialEnvelope;
  encryptedRefreshToken: CredentialEnvelope;
  keyVersion: string;
  version: number;
  createdAt: string;
  lastUsedAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  revokedAt: string | null;
};

// 新規セッション作成用パラメータ
type CreateSessionParams = {
  rawSessionId: string;
  userId: string;
  credentials: SessionCredentials;
  now?: Date;
};

// セッションのタイムスタンプを計算（ISO文字列で返す — Drizzle timestamp mode:"string" 互換）
const computeTimestamps = (now: Date) => {
  const idleExpires = new Date(now.getTime() + IDLE_TIMEOUT_MS);
  const absoluteExpires = new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS);
  return {
    createdAt: now.toISOString(),
    lastUsedAt: now.toISOString(),
    idleExpiresAt: idleExpires.toISOString(),
    absoluteExpiresAt: absoluteExpires.toISOString(),
  };
};

// DBエラーを SessionRepoError にラップ（cause チェーン保持）
const wrapDbError = (e: unknown, message: string): SessionRepoError =>
  new SessionRepoError({ message, cause: e });

// 新規サーバーセッションを作成
export const createServerSession = async (
  db: DatabaseOrTransaction,
  params: CreateSessionParams,
): Promise<ServerSession | Error> => {
  const now = params.now ?? new Date();
  const timestamps = computeTimestamps(now);
  const sessionHash = await hashSessionId(params.rawSessionId);
  if (sessionHash instanceof Error) return sessionHash;

  const result = await db
    .insert(serverSessions)
    .values({
      sessionHash,
      userId: params.userId,
      encryptedSessionCredential: params.credentials.encryptedSessionCredential,
      encryptedRefreshToken: params.credentials.encryptedRefreshToken,
      keyVersion: params.credentials.keyVersion,
      ...timestamps,
    })
    .returning()
    .catch((e) => wrapDbError(e, "セッションの作成に失敗しました。"));

  if (result instanceof Error) return result;
  const row = result[0];
  if (!row) {
    return new SessionRepoError({ message: "セッション作成結果が空です。" });
  }
  return rowToSession(row);
};

// オペークIDから有効なセッションを取得（revoked/expired を除外）
export const getValidSessionByOpaqueId = async (
  db: DatabaseOrTransaction,
  rawSessionId: string,
  now: Date = new Date(),
): Promise<ServerSession | null | Error> => {
  const sessionHash = await hashSessionId(rawSessionId);
  if (sessionHash instanceof Error) return sessionHash;
  const nowIso = now.toISOString();

  const result = await db
    .select()
    .from(serverSessions)
    .where(
      and(
        eq(serverSessions.sessionHash, sessionHash),
        isNull(serverSessions.revokedAt),
        gt(serverSessions.idleExpiresAt, nowIso),
        gt(serverSessions.absoluteExpiresAt, nowIso),
      ),
    )
    .limit(1)
    .catch((e) => wrapDbError(e, "セッション参照に失敗しました。"));

  if (result instanceof Error) return result;
  const row = result[0];
  if (!row) return null;
  return rowToSession(row);
};

// セッションIDから現在の（期限切れや無効化を問わない）セッションを1件取得（CAS再読み込み用）
export const getCurrentSessionById = async (
  db: DatabaseOrTransaction,
  sessionId: string,
): Promise<ServerSession | null | Error> => {
  const result = await db
    .select()
    .from(serverSessions)
    .where(eq(serverSessions.id, sessionId))
    .limit(1)
    .catch((e) => wrapDbError(e, "セッション再参照に失敗しました。"));

  if (result instanceof Error) return result;
  const row = result[0];
  if (!row) return null;
  return rowToSession(row);
};

// last_used_at をスロットリング付きで更新
export const touchSession = async (
  db: DatabaseOrTransaction,
  sessionId: string,
  now: Date = new Date(),
): Promise<void | Error> => {
  // 最終使用時刻がスロットル間隔内なら更新をスキップ
  const throttleBefore = new Date(now.getTime() - LAST_USED_UPDATE_INTERVAL_MS).toISOString();
  // idle延長は絶対有効期限を超えないようにクリップ
  const rawIdleExpires = new Date(now.getTime() + IDLE_TIMEOUT_MS);
  const result = await db
    .update(serverSessions)
    .set({
      lastUsedAt: now.toISOString(),
      idleExpiresAt: sql`LEAST(${rawIdleExpires.toISOString()}, ${serverSessions.absoluteExpiresAt})`,
    })
    .where(and(eq(serverSessions.id, sessionId), lt(serverSessions.lastUsedAt, throttleBefore)))
    .catch((e) => wrapDbError(e, "touchSession の更新に失敗しました。"));
  if (result instanceof Error) return result;
};

// セッションの Firebase クレデンシャルを原子更新（楽観的排他制御付き）
// 戻り値: 更新成功→ServerSession、CAS競合または無効化→null、DBエラー→Error
export const refreshSessionCredentials = async (
  db: DatabaseOrTransaction,
  sessionId: string,
  expectedVersion: number,
  newCredentials: SessionCredentials,
  now: Date = new Date(),
): Promise<ServerSession | null | Error> => {
  // idle延長は絶対有効期限を超えないようにクリップ
  const rawIdleExpires = new Date(now.getTime() + IDLE_TIMEOUT_MS);
  const result = await db
    .update(serverSessions)
    .set({
      encryptedSessionCredential: newCredentials.encryptedSessionCredential,
      encryptedRefreshToken: newCredentials.encryptedRefreshToken,
      keyVersion: newCredentials.keyVersion,
      lastUsedAt: now.toISOString(),
      idleExpiresAt: sql`LEAST(${rawIdleExpires.toISOString()}, ${serverSessions.absoluteExpiresAt})`,
      version: sql`${serverSessions.version} + 1`,
    })
    .where(
      and(
        eq(serverSessions.id, sessionId),
        eq(serverSessions.version, expectedVersion),
        isNull(serverSessions.revokedAt),
        gt(serverSessions.idleExpiresAt, now.toISOString()),
        gt(serverSessions.absoluteExpiresAt, now.toISOString()),
      ),
    )
    .returning()
    .catch((e) => wrapDbError(e, "セッションクレデンシャル更新に失敗しました。"));

  if (result instanceof Error) return result;
  const row = result[0];
  if (!row) return null; // CAS競合または無効化済み
  return rowToSession(row);
};

// セッションを無効化
export const revokeSession = async (
  db: DatabaseOrTransaction,
  sessionId: string,
  now: Date = new Date(),
): Promise<void | Error> => {
  const result = await db
    .update(serverSessions)
    .set({ revokedAt: now.toISOString() })
    .where(eq(serverSessions.id, sessionId))
    .catch((e) => wrapDbError(e, "セッション無効化に失敗しました。"));
  if (result instanceof Error) return result;
};

// ユーザーの全セッションを無効化
export const revokeAllUserSessions = async (
  db: DatabaseOrTransaction,
  userId: string,
  now: Date = new Date(),
): Promise<void | Error> => {
  const result = await db
    .update(serverSessions)
    .set({ revokedAt: now.toISOString() })
    .where(and(eq(serverSessions.userId, userId), isNull(serverSessions.revokedAt)))
    .catch((e) => wrapDbError(e, "ユーザーセッション一括無効化に失敗しました。"));
  if (result instanceof Error) return result;
};

// 指定キーバージョンで暗号化されたアクティブセッションを取得（ハッシュ含む、バッチ再暗号化用）
type SessionWithHash = ServerSession & { sessionHash: string };

export const getSessionsByKeyVersion = async (
  db: DatabaseOrTransaction,
  keyVersion: string,
  limit: number = 50,
): Promise<SessionWithHash[] | Error> => {
  const rows = await db
    .select()
    .from(serverSessions)
    .where(
      and(
        eq(serverSessions.keyVersion, keyVersion),
        isNull(serverSessions.revokedAt),
        gt(serverSessions.idleExpiresAt, new Date().toISOString()),
        gt(serverSessions.absoluteExpiresAt, new Date().toISOString()),
      ),
    )
    .limit(limit)
    .catch((e) => wrapDbError(e, "キーバージョン別セッション取得に失敗しました。"));

  if (rows instanceof Error) return rows;
  const sessions: SessionWithHash[] = [];
  for (const row of rows) {
    const session = rowToSession(row);
    if (session instanceof Error) return session;
    sessions.push({ ...session, sessionHash: row.sessionHash });
  }
  return sessions;
};

// 指定キーバージョンで残存するアクティブセッション数をカウント（ローテーション完了確認用）
export const countSessionsByKeyVersion = async (
  db: DatabaseOrTransaction,
  keyVersion: string,
): Promise<number | Error> => {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serverSessions)
    .where(
      and(
        eq(serverSessions.keyVersion, keyVersion),
        isNull(serverSessions.revokedAt),
        gt(serverSessions.idleExpiresAt, new Date().toISOString()),
        gt(serverSessions.absoluteExpiresAt, new Date().toISOString()),
      ),
    )
    .catch((e) => wrapDbError(e, "キーバージョン別セッションカウントに失敗しました。"));

  if (result instanceof Error) return result;
  return result[0]?.count ?? 0;
};

// DB行を ServerSession 型に変換
const rowToSession = (
  row: typeof serverSessions.$inferSelect,
): ServerSession | SessionRepoError => {
  const sessionCredential = validateEnvelope(row.encryptedSessionCredential);
  if (sessionCredential instanceof Error) {
    return new SessionRepoError({
      message: "保存されたセッションクレデンシャルの形式が不正です。",
      cause: sessionCredential,
    });
  }

  const refreshToken = validateEnvelope(row.encryptedRefreshToken);
  if (refreshToken instanceof Error) {
    return new SessionRepoError({
      message: "保存されたリフレッシュトークンの形式が不正です。",
      cause: refreshToken,
    });
  }

  if (sessionCredential.kid !== refreshToken.kid || sessionCredential.kid !== row.keyVersion) {
    return new SessionRepoError({
      message: "保存されたセッションクレデンシャルのキーIDが一致しません。",
    });
  }

  return {
    id: row.id,
    userId: row.userId,
    encryptedSessionCredential: sessionCredential,
    encryptedRefreshToken: refreshToken,
    keyVersion: row.keyVersion,
    version: row.version,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    idleExpiresAt: row.idleExpiresAt,
    absoluteExpiresAt: row.absoluteExpiresAt,
    revokedAt: row.revokedAt ?? null,
  };
};
