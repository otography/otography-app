import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@repo/errors/server";
import {
  mockCreateSessionCookie,
  mockDecryptCredential,
  mockEncryptCredential,
  mockExchangeRefreshToken,
  mockCountSessionsByKeyVersion,
  mockGetCurrentSessionById,
  mockGetSessionsByKeyVersion,
  mockGetValidSessionByOpaqueId,
  mockRefreshSessionCredentials,
  mockRevokeSession,
  mockTouchSession,
  mockVerifySessionCookie,
} from "../../setup";

vi.unmock("../../../shared/auth/session-service");

import {
  batchReEncrypt,
  countRemainingByKey,
  resolveSession,
} from "../../../shared/auth/session-service";
import type { ServerSession } from "../../../shared/auth/session-repository";

const envelope = (purpose: "session" | "refresh") => ({
  v: 1 as const,
  kid: "test-key-1",
  iv: "00".repeat(12),
  ct: `encrypted-${purpose}-credential`,
});

describe("key rotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDecryptCredential.mockReset();
    mockEncryptCredential.mockReset();
    mockDecryptCredential
      .mockResolvedValueOnce("firebase-session-cookie")
      .mockResolvedValueOnce("firebase-refresh-token");
    mockEncryptCredential
      .mockResolvedValueOnce(envelope("session"))
      .mockResolvedValueOnce(envelope("refresh"));
    mockRefreshSessionCredentials.mockResolvedValue(createSession({ version: 2 }));
  });

  it("旧キーのセッションを指定件数までアクティブキーで再暗号化する", async () => {
    mockGetSessionsByKeyVersion.mockResolvedValue([
      { ...createSession({ keyVersion: "old-key" }), sessionHash: "a".repeat(64) },
    ]);

    const result = await batchReEncrypt({} as never, ctx, "old-key", 25);

    expect(mockGetSessionsByKeyVersion).toHaveBeenCalledWith(expect.anything(), "old-key", 25);
    expect(result).toMatchObject({ reEncrypted: 1, errors: [] });
    expect(mockRefreshSessionCredentials).toHaveBeenCalledWith(
      expect.anything(),
      "session-id",
      1,
      expect.objectContaining({ keyVersion: "test-key-1" }),
    );
  });

  it("旧キーで残っている有効セッション数を返す", async () => {
    mockCountSessionsByKeyVersion.mockResolvedValue(3);

    await expect(countRemainingByKey({} as never, "old-key")).resolves.toBe(3);
  });
});

const createSession = (overrides: Partial<ServerSession> = {}): ServerSession => ({
  id: "session-id",
  userId: "user-id",
  encryptedSessionCredential: envelope("session"),
  encryptedRefreshToken: envelope("refresh"),
  keyVersion: "test-key-1",
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastUsedAt: "2026-01-01T00:00:00.000Z",
  idleExpiresAt: "2999-01-01T00:00:00.000Z",
  absoluteExpiresAt: "2999-01-01T00:00:00.000Z",
  revokedAt: null,
  ...overrides,
});

const ctx = {
  activeKeyId: "test-key-1",
  activeKey: {} as CryptoKey,
  keys: new Map([
    ["test-key-1", { id: "test-key-1", cryptoKey: {} as CryptoKey, decryptOnly: false }],
  ]),
};

describe("resolveSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDecryptCredential.mockReset();
    mockEncryptCredential.mockReset();
    mockGetValidSessionByOpaqueId.mockResolvedValue(createSession());
    mockDecryptCredential
      .mockResolvedValueOnce("firebase-session-cookie")
      .mockResolvedValueOnce("firebase-refresh-token");
    mockTouchSession.mockResolvedValue(undefined);
    mockRevokeSession.mockResolvedValue(undefined);
  });

  it("CAS競合後に再読込したセッションが期限切れなら認証しない", async () => {
    mockVerifySessionCookie.mockResolvedValueOnce(new Error("expired"));
    mockExchangeRefreshToken.mockResolvedValue({
      id_token: "new-id-token",
      refresh_token: "new-refresh-token",
    });
    mockCreateSessionCookie.mockResolvedValue("new-session-cookie");
    mockEncryptCredential
      .mockResolvedValueOnce(envelope("session"))
      .mockResolvedValueOnce(envelope("refresh"));
    mockRefreshSessionCredentials.mockResolvedValue(null);
    mockGetCurrentSessionById.mockResolvedValue(
      createSession({ idleExpiresAt: "2000-01-01T00:00:00.000Z", version: 2 }),
    );

    const result = await resolveSession("opaque-session-id", {} as never, ctx);

    expect(result).toBeNull();
    expect(mockVerifySessionCookie).toHaveBeenCalledTimes(1);
  });

  it("リフレッシュ後の暗号化失敗ではセッションを失効させ端末エラーにする", async () => {
    mockVerifySessionCookie.mockResolvedValueOnce(new Error("expired"));
    mockExchangeRefreshToken.mockResolvedValue({
      id_token: "new-id-token",
      refresh_token: "new-refresh-token",
    });
    mockCreateSessionCookie.mockResolvedValue("new-session-cookie");
    mockEncryptCredential.mockResolvedValueOnce(new Error("KMS unavailable"));

    const result = await resolveSession("opaque-session-id", {} as never, ctx);

    expect(mockRevokeSession).toHaveBeenCalledWith(expect.anything(), "session-id");
    expect(result).toBeInstanceOf(AuthError);
    expect((result as AuthError).clearCookie).toBe(true);
  });
});
