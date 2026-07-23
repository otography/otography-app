import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db/client";
import { users, serverSessions } from "../../../shared/db/schema";
import {
  createServerSession,
  getValidSessionByOpaqueId,
  touchSession,
  refreshSessionCredentials,
  revokeSession,
  revokeAllUserSessions,
} from "../../../shared/auth/session-repository";
import type { CredentialEnvelope } from "../../../shared/auth/envelope";
import type { SessionCredentials } from "../../../shared/auth/session-repository";

// crypto モックを回避して実モジュールを使用
vi.mock("../../../shared/auth/session-crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/auth/session-crypto")>();
  return { ...actual };
});

const sql = createTestSql();
const db = createTestDb(sql);

afterAll(async () => {
  await sql.end();
});

const testEnvelope: CredentialEnvelope = {
  v: 1,
  kid: "key-active",
  iv: "00".repeat(12),
  ct: "de".repeat(16),
};

const testCredentials: SessionCredentials = {
  encryptedSessionCredential: testEnvelope,
  encryptedRefreshToken: { ...testEnvelope, ct: "ca".repeat(16) },
  keyVersion: "key-active",
};

const createUser = async () => {
  const [row] = await db
    .insert(users)
    .values({ firebaseId: `fb-${Date.now()}-${Math.random()}` })
    .returning({ id: users.id });
  return row!;
};

describe("createServerSession", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("新規セッションを作成して返す", async () => {
    const user = await createUser();
    const result = await createServerSession(db, {
      rawSessionId: "test-opaque-id-12345",
      userId: user.id,
      credentials: testCredentials,
    });

    expect(result).not.toBeInstanceOf(Error);
    const session = result as Exclude<typeof result, Error>;
    expect(session.userId).toBe(user.id);
    expect(session.encryptedSessionCredential.ct).toBe("de".repeat(16));
    expect(session.version).toBe(1);
    expect(session.revokedAt ?? null).toBeNull();
  });

  it("raw セッションID を保存せず、ハッシュのみを保存する", async () => {
    const user = await createUser();
    await createServerSession(db, {
      rawSessionId: "my-raw-session-id",
      userId: user.id,
      credentials: testCredentials,
    });

    // raw 値がDBに保存されていないことを確認
    const rows = await sql<{ session_hash: string }[]>`
      SELECT session_hash FROM server_sessions WHERE user_id = ${user.id}
    `;
    expect(rows[0]!.session_hash).not.toContain("my-raw-session-id");
    expect(rows[0]!.session_hash).toHaveLength(64); // SHA-256 hex
  });
});

describe("getValidSessionByOpaqueId", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("ハッシュが一致する有効なセッションを返す", async () => {
    const user = await createUser();
    await createServerSession(db, {
      rawSessionId: "valid-id",
      userId: user.id,
      credentials: testCredentials,
    });

    const result = await getValidSessionByOpaqueId(db, "valid-id");
    expect(result).not.toBeInstanceOf(Error);
    expect(result).not.toBeNull();
  });

  it("ハッシュが一致しない場合は null を返す", async () => {
    const user = await createUser();
    await createServerSession(db, {
      rawSessionId: "valid-id",
      userId: user.id,
      credentials: testCredentials,
    });

    const result = await getValidSessionByOpaqueId(db, "wrong-id");
    expect(result).toBeNull();
  });

  it("無効化されたセッションは返さない", async () => {
    const user = await createUser();
    const created = await createServerSession(db, {
      rawSessionId: "to-revoke",
      userId: user.id,
      credentials: testCredentials,
    });
    const session = created as Exclude<typeof created, Error>;
    await revokeSession(db, session.id);

    const result = await getValidSessionByOpaqueId(db, "to-revoke");
    expect(result).toBeNull();
  });

  it("アイドルタイムアウト切れのセッションは返さない", async () => {
    const user = await createUser();
    // 6日前に作成（5日のアイドルタイムアウト超過）
    const past = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    await createServerSession(db, {
      rawSessionId: "expired-idle",
      userId: user.id,
      credentials: testCredentials,
      now: past,
    });

    const result = await getValidSessionByOpaqueId(db, "expired-idle");
    expect(result).toBeNull();
  });

  it("絶対タイムアウト切れのセッションは返さない", async () => {
    const user = await createUser();
    // 15日前に作成（14日の絶対タイムアウト超過）
    const past = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    await createServerSession(db, {
      rawSessionId: "expired-absolute",
      userId: user.id,
      credentials: testCredentials,
      now: past,
    });

    const result = await getValidSessionByOpaqueId(db, "expired-absolute");
    expect(result).toBeNull();
  });
});

describe("touchSession", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("last_used_at を更新し、アイドルタイムアウトを延長する", async () => {
    const user = await createUser();
    const created = await createServerSession(db, {
      rawSessionId: "touch-me",
      userId: user.id,
      credentials: testCredentials,
    });
    const session = created as Exclude<typeof created, Error>;

    // スロットル間隔（5分）以上待つシミュレーションとして、
    // 6分前の last_used_at を持つセッションを作成
    const past = new Date(Date.now() - 6 * 60 * 1000);
    await db
      .update(serverSessions)
      .set({ lastUsedAt: past.toISOString() })
      .where(eq(serverSessions.id, session.id));

    await touchSession(db, session.id);

    const [updated] = await db
      .select()
      .from(serverSessions)
      .where(eq(serverSessions.id, session.id));
    expect(new Date(updated!.lastUsedAt).getTime()).toBeGreaterThan(past.getTime());
  });

  it("スロットル間隔内は更新をスキップする", async () => {
    const user = await createUser();
    const created = await createServerSession(db, {
      rawSessionId: "skip-touch",
      userId: user.id,
      credentials: testCredentials,
    });
    const session = created as Exclude<typeof created, Error>;
    const originalLastUsed = session.lastUsedAt;

    // 直後に touch → スロットル間隔内なので更新されない
    await touchSession(db, session.id);

    const [updated] = await db
      .select()
      .from(serverSessions)
      .where(eq(serverSessions.id, session.id));
    // last_used_at が変化していないことを確認
    expect(updated!.lastUsedAt).toBe(originalLastUsed);
  });
});

describe("refreshSessionCredentials", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("正しいバージョンでクレデンシャルを原子更新する", async () => {
    const user = await createUser();
    const created = await createServerSession(db, {
      rawSessionId: "refresh-me",
      userId: user.id,
      credentials: testCredentials,
    });
    const session = created as Exclude<typeof created, Error>;

    const newCreds: SessionCredentials = {
      encryptedSessionCredential: { ...testEnvelope, ct: "ab".repeat(16) },
      encryptedRefreshToken: { ...testEnvelope, ct: "cd".repeat(16) },
      keyVersion: "key-active",
    };

    const result = await refreshSessionCredentials(db, session.id, 1, newCreds);
    expect(result).not.toBeInstanceOf(Error);
    expect(result).not.toBeNull();
    const updated = result as Exclude<typeof result, Error | null>;
    expect(updated.version).toBe(2);
    expect(updated.encryptedSessionCredential.ct).toBe("ab".repeat(16));
  });

  it("バージョンが不一致（並行更新）の場合、失敗する", async () => {
    const user = await createUser();
    const created = await createServerSession(db, {
      rawSessionId: "concurrent-refresh",
      userId: user.id,
      credentials: testCredentials,
    });
    const session = created as Exclude<typeof created, Error>;

    // 既に version=2 の状態で version=1 を期待すると失敗
    const newCreds: SessionCredentials = {
      encryptedSessionCredential: testEnvelope,
      encryptedRefreshToken: testEnvelope,
      keyVersion: "key-active",
    };

    // 最初の更新（成功）
    await refreshSessionCredentials(db, session.id, 1, newCreds);

    // 同じ version=1 で再度更新（並行競合）→ CAS競合で null
    const result = await refreshSessionCredentials(db, session.id, 1, newCreds);
    expect(result).toBeNull();
  });

  it("無効化されたセッションの更新は失敗する", async () => {
    const user = await createUser();
    const created = await createServerSession(db, {
      rawSessionId: "revoked-refresh",
      userId: user.id,
      credentials: testCredentials,
    });
    const session = created as Exclude<typeof created, Error>;
    await revokeSession(db, session.id);

    const result = await refreshSessionCredentials(db, session.id, 1, testCredentials);
    expect(result).toBeNull();
  });
});

describe("revokeAllUserSessions", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("ユーザーの全アクティブセッションを無効化する", async () => {
    const user = await createUser();
    await createServerSession(db, {
      rawSessionId: "session-1",
      userId: user.id,
      credentials: testCredentials,
    });
    await createServerSession(db, {
      rawSessionId: "session-2",
      userId: user.id,
      credentials: testCredentials,
    });

    await revokeAllUserSessions(db, user.id);

    const result1 = await getValidSessionByOpaqueId(db, "session-1");
    const result2 = await getValidSessionByOpaqueId(db, "session-2");
    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });
});
