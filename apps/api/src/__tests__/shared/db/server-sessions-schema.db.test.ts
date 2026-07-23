import { sql as drizzleSql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db/client";
import { users, serverSessions } from "../../../shared/db/schema";

const sql = createTestSql();
const db = createTestDb(sql);

afterAll(async () => {
  await sql.end();
});

describe("server_sessions テーブルスキーマ", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("server_sessions テーブルが存在する", async () => {
    const result = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'server_sessions'
    `;
    expect(result).toHaveLength(1);
  });

  it("server_sessions は RLS が無効（バックエンド基盤テーブル）", async () => {
    const result = await sql<{ relrowsecurity: boolean }[]>`
      SELECT relrowsecurity
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname = 'server_sessions'
    `;
    expect(result).toHaveLength(1);
    expect(result[0]!.relrowsecurity).toBe(false);
  });

  it.each(["anon", "authenticated"])(
    "%s ロールは server_sessions へ SELECT アクセスできない",
    async (role) => {
      const result = await sql
        .begin(async (transaction) => {
          await transaction.unsafe(`SET LOCAL ROLE ${role}`);
          return transaction`SELECT id FROM public.server_sessions LIMIT 1`;
        })
        .catch((error: unknown) => error);

      expect(result).toBeInstanceOf(Error);
      expect((result as { code?: string }).code).toBe("42501");
    },
  );

  it("FK: server_sessions.user_id -> users.id (ON DELETE CASCADE)", async () => {
    // FK 制約の存在を確認
    const result = await sql<{ constraint_name: string; on_delete: string }[]>`
      SELECT conname AS constraint_name, confdeltype AS on_delete
      FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid = 'server_sessions'::regclass
    `;
    expect(result).toHaveLength(1);
    expect(result[0]!.on_delete).toBe("c"); // 'c' = CASCADE
  });

  it("FK CASCADE: ユーザー削除時にセッションも削除される", async () => {
    const [user] = await db
      .insert(users)
      .values({ firebaseId: "fb-cascade-test" })
      .returning({ id: users.id });

    await db.insert(serverSessions).values({
      sessionHash: "b".repeat(64),
      userId: user!.id,
      encryptedSessionCredential: { v: 1, kid: "k1", iv: "ab", ct: "cd" },
      encryptedRefreshToken: { v: 1, kid: "k1", iv: "ef", ct: "gh" },
      keyVersion: "k1",
      idleExpiresAt: "2026-12-31T00:00:00Z",
      absoluteExpiresAt: "2026-12-31T00:00:00Z",
    });

    // ユーザー削除
    await db.delete(users).where(drizzleSql`${users.id} = ${user!.id}`);

    // セッションも削除されていることを確認
    const sessions = await db
      .select()
      .from(serverSessions)
      .where(drizzleSql`${serverSessions.userId} = ${user!.id}`);
    expect(sessions).toHaveLength(0);
  });

  it("key_version は NOT NULL 制約で拒否される", async () => {
    const [user] = await db
      .insert(users)
      .values({ firebaseId: "fb-null-key" })
      .returning({ id: users.id });

    // NOT NULL 制約をテストするため、raw SQL で null を挿入
    const hash = "c".repeat(64);
    const result = await sql`
      INSERT INTO server_sessions (session_hash, user_id, encrypted_session_credential, encrypted_refresh_token, key_version, idle_expires_at, absolute_expires_at)
      VALUES (${hash}, ${user!.id}, '{"v":1}'::jsonb, '{"v":1}'::jsonb, NULL, '2026-12-31', '2026-12-31')
    `.catch((e) => e);

    expect(result).toBeInstanceOf(Error);
  });

  it("service role (postgres) は server_sessions に挿入・読み取りが可能", async () => {
    const [user] = await db
      .insert(users)
      .values({ firebaseId: "fb-test-session" })
      .returning({ id: users.id });

    const [session] = await db
      .insert(serverSessions)
      .values({
        sessionHash: "a".repeat(64),
        userId: user!.id,
        encryptedSessionCredential: { v: 1, kid: "k1", iv: "ab", ct: "cd" },
        encryptedRefreshToken: { v: 1, kid: "k1", iv: "ef", ct: "gh" },
        keyVersion: "k1",
        idleExpiresAt: "2026-12-31T00:00:00Z",
        absoluteExpiresAt: "2026-12-31T00:00:00Z",
      })
      .returning({ id: serverSessions.id });

    expect(session).toBeDefined();

    const rows = await db
      .select()
      .from(serverSessions)
      .where(drizzleSql`${serverSessions.id} = ${session!.id}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sessionHash).toBe("a".repeat(64));
  });

  it("必須カラムが NULL の場合、挿入を拒否する", async () => {
    const result = await db
      .insert(serverSessions)
      // @ts-expect-error: テスト用に必須フィールドを省略
      .values({})
      .catch((e) => e);

    expect(result).toBeInstanceOf(Error);
  });
});
