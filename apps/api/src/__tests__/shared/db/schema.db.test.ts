import { sql as drizzleSql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db/client";
import { isPostgresCheckViolation } from "../../../shared/db/postgres-error";
import { users } from "../../../shared/db/schema";

const sql = createTestSql();
const db = createTestDb(sql);

afterAll(async () => {
  await sql.end();
});

describe("マイグレーション", () => {
  it("全 public テーブルで RLS が有効になっている", async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname IN (
          'artists', 'favorite_artists', 'favorite_songs', 'genres',
          'group_songs', 'groups', 'post_likes', 'posts',
          'song_artists', 'song_genres', 'songs', 'users'
        )
      ORDER BY relname
    `;

    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    expect(rows).toHaveLength(12);
  });

  it("ヘルパー関数の search_path が pg_catalog に固定されている", async () => {
    const functions = await sql<{ proname: string; search_path: string | null }[]>`
      SELECT proname,
        (SELECT split_part(option, '=', 2)
         FROM unnest(proconfig) option
         WHERE option LIKE 'search_path=%') AS search_path
      FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('gen_random_uuid_v7', 'uuid_generate_v7')
      ORDER BY proname
    `;

    expect(functions).toEqual([
      { proname: "gen_random_uuid_v7", search_path: "pg_catalog" },
      { proname: "uuid_generate_v7", search_path: "pg_catalog" },
    ]);
  });
});

describe("DB関数: resolve_firebase_id", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("アクティブユーザーのIDを返す", async () => {
    // Given
    const [user] = await db
      .insert(users)
      .values({ firebaseId: "firebase-active" })
      .returning({ id: users.id });

    // When
    const result = await db.execute<{ user_id: string | null }>(drizzleSql`
      SELECT public.resolve_firebase_id('firebase-active') AS user_id
    `);

    // Then
    expect(result).toEqual([{ user_id: user!.id }]);
  });

  it("論理削除ユーザーには null を返す", async () => {
    // Given
    await db.insert(users).values({
      firebaseId: "firebase-deleted",
      deletedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    // When
    const result = await db.execute<{ user_id: string | null }>(drizzleSql`
      SELECT public.resolve_firebase_id('firebase-deleted') AS user_id
    `);

    // Then
    expect(result).toEqual([{ user_id: null }]);
  });
});

describe("DB関数: sync_firebase_user", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("新規ユーザーを作成し、同じ呼び出しで冪等に返す", async () => {
    await db.transaction(async (tx) => {
      await tx.execute(drizzleSql.raw("set local role authenticated"));

      const inserted = await tx.execute<{ id: string }>(drizzleSql`
        SELECT id FROM public.sync_firebase_user('firebase-sync-user')
      `);
      const restored = await tx.execute<{ id: string }>(drizzleSql`
        SELECT id FROM public.sync_firebase_user('firebase-sync-user')
      `);

      expect(inserted).toHaveLength(1);
      expect(restored).toEqual(inserted);
    });
  });
});

describe("CHECK制約: users", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("username に空白のみは許可しない", async () => {
    // Given
    await db.insert(users).values({ firebaseId: "firebase-ok" });

    // When
    const result = await db
      .insert(users)
      .values({ firebaseId: "firebase-blank", username: "   " })
      .catch((e) => e);

    // Then
    expect(isPostgresCheckViolation(result, "users_username_min_length")).toBe(true);
  });
});
