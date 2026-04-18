import { describe, expect, it, vi } from "vitest";
import { mockVerifySessionCookie } from "../../setup";
import { testRequest } from "../../helpers/test-client";

// DB モック
vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(),
}));

// Embedding生成モック — 基本CRUDテストではembedding生成をスキップ
vi.mock("../../../features/posts/lib/embedding", () => ({
  generateEmbedding: vi.fn().mockResolvedValue(null),
}));

import { createDb } from "../../../shared/db";

// createDb().select().from().where().limit() のチェーン用モック
const mockDbWithSelect = (resolvedValue: unknown[]) => {
  vi.mocked(createDb).mockReturnValue({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(resolvedValue),
        })),
      })),
    })),
  } as never);
};

// トランザクション内の tx.select().from().where().limit() チェーン用モック
const mockTxSelect = (result: unknown[]) =>
  vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(result),
      })),
    })),
  }));

// テスト用UUID（すべて有効なUUID v4形式）
const SONG_ID = "550e8400-e29b-41d4-a716-446655440001";
const USER_ID = "550e8400-e29b-41d4-a716-446655440002";
const OTHER_USER_ID = "550e8400-e29b-41d4-a716-446655440003";
const POST_ID = "550e8400-e29b-41d4-a716-446655440004";
const NONEXISTENT_ID = "a0000000-0000-4000-a000-000000000000";

// テスト用のモックデータ
const mockUser = {
  id: USER_ID,
  firebaseId: "firebase-user-001",
  username: "testuser",
  name: "Test User",
  bio: null,
  birthplace: null,
  birthyear: null,
  gender: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
};

const mockPost = {
  id: POST_ID,
  userId: USER_ID,
  songId: SONG_ID,
  content: "素晴らしい曲です",
  embedding: null,
  createdAt: new Date("2026-01-15T00:00:00.000Z"),
  updatedAt: new Date("2026-01-15T00:00:00.000Z"),
  deletedAt: null,
};

const mockOtherUser = {
  id: OTHER_USER_ID,
  firebaseId: "firebase-user-002",
  username: "otheruser",
  name: "Other User",
  bio: null,
  birthplace: null,
  birthyear: null,
  gender: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
};

// セットアップヘルパー: 有効なセッションCookie付きリクエスト
const validSession = {
  sub: "firebase-user-001",
  uid: "firebase-user-001",
  email: "test@example.com",
};

const otherUserSession = {
  sub: "firebase-user-002",
  uid: "firebase-user-002",
  email: "other@example.com",
};

// createDb() が select → transaction → transaction の順で呼ばれるテスト用モック
// selectResults: 直接select呼び出しの結果（selectPostById など）
// txMethods: トランザクション内で使用するメソッド（execute, select, insert, update など）
const mockDbWithSelectAndTransaction = (
  selectResults: unknown[][],
  txMethods: Record<string, unknown>,
) => {
  let callCount = 0;
  vi.mocked(createDb).mockImplementation(
    () =>
      ({
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => {
                const result = selectResults[callCount];
                callCount++;
                return result ?? [];
              }),
            })),
          })),
        })),
        transaction: vi.fn(async (fn) => fn(txMethods)),
      }) as never,
  );
};

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await testRequest("/api/posts", {
      method: "POST",
      body: { content: "テスト投稿", songId: SONG_ID },
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 when content is missing", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    const res = await testRequest("/api/posts", {
      method: "POST",
      cookie: { otography_session: "valid-session" },
      body: { songId: SONG_ID },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Invalid post data." });
  });

  it("returns 400 when content is empty string", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    const res = await testRequest("/api/posts", {
      method: "POST",
      cookie: { otography_session: "valid-session" },
      body: { content: "", songId: SONG_ID },
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when content is whitespace only", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    const res = await testRequest("/api/posts", {
      method: "POST",
      cookie: { otography_session: "valid-session" },
      body: { content: "   ", songId: SONG_ID },
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when content exceeds 200 characters", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    const res = await testRequest("/api/posts", {
      method: "POST",
      cookie: { otography_session: "valid-session" },
      body: { content: "あ".repeat(201), songId: SONG_ID },
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when songId is missing", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    const res = await testRequest("/api/posts", {
      method: "POST",
      cookie: { otography_session: "valid-session" },
      body: { content: "テスト投稿" },
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when songId is not a valid UUID", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    const res = await testRequest("/api/posts", {
      method: "POST",
      cookie: { otography_session: "valid-session" },
      body: { content: "テスト投稿", songId: "not-a-uuid" },
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 when user does not exist in DB", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);
    // selectUserByFirebaseId (withRls transaction) → ユーザーなし
    mockDbWithSelectAndTransaction([], {
      select: mockTxSelect([]),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/posts", {
      method: "POST",
      cookie: { otography_session: "valid-session" },
      body: { content: "テスト投稿", songId: SONG_ID },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "User not found." });
  });

  it("returns 201 with created post on success", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    // selectUserByFirebaseId (withRls transaction) → ユーザーあり
    // insertPost (withRls transaction)
    mockDbWithSelectAndTransaction([], {
      select: mockTxSelect([mockUser]),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([mockPost]),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/posts", {
      method: "POST",
      cookie: { otography_session: "valid-session" },
      body: { content: "素晴らしい曲です", songId: SONG_ID },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toBe("Post created.");
    expect(body.post).toMatchObject({
      id: POST_ID,
      content: "素晴らしい曲です",
      songId: SONG_ID,
      userId: USER_ID,
    });
  });

  it("accepts content of exactly 200 characters", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    mockDbWithSelectAndTransaction([], {
      select: mockTxSelect([mockUser]),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ ...mockPost, content: "あ".repeat(200) }]),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/posts", {
      method: "POST",
      cookie: { otography_session: "valid-session" },
      body: { content: "あ".repeat(200), songId: SONG_ID },
    });

    expect(res.status).toBe(201);
  });

  it("accepts content of exactly 1 character", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    mockDbWithSelectAndTransaction([], {
      select: mockTxSelect([mockUser]),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ ...mockPost, content: "あ" }]),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/posts", {
      method: "POST",
      cookie: { otography_session: "valid-session" },
      body: { content: "あ", songId: SONG_ID },
    });

    expect(res.status).toBe(201);
  });

  it("returns 500 when DB insert fails", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    mockDbWithSelectAndTransaction([], {
      select: mockTxSelect([mockUser]),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockRejectedValue(new Error("DB error")),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/posts", {
      method: "POST",
      cookie: { otography_session: "valid-session" },
      body: { content: "テスト投稿", songId: SONG_ID },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Failed to create post." });
  });
});

describe("GET /api/posts/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with post data for existing post", async () => {
    mockDbWithSelect([mockPost]);

    const res = await testRequest(`/api/posts/${POST_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.post).toMatchObject({
      id: POST_ID,
      content: "素晴らしい曲です",
      songId: SONG_ID,
      userId: USER_ID,
    });
  });

  it("returns 404 for non-existent post", async () => {
    mockDbWithSelect([]);

    const res = await testRequest(`/api/posts/${NONEXISTENT_ID}`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Post not found." });
  });
});

describe("PATCH /api/posts/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await testRequest(`/api/posts/${POST_ID}`, {
      method: "PATCH",
      body: { content: "更新内容" },
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 when content is empty", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    const res = await testRequest(`/api/posts/${POST_ID}`, {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { content: "" },
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when content exceeds 200 characters", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    const res = await testRequest(`/api/posts/${POST_ID}`, {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { content: "あ".repeat(201) },
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when content is whitespace only", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    const res = await testRequest(`/api/posts/${POST_ID}`, {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { content: "   " },
    });

    expect(res.status).toBe(400);
  });

  it("returns 200 with updated post on success", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    // selectPostById (createDb().select()) → 投稿あり
    // selectUserByFirebaseId (withRls transaction) → ユーザーあり、所有者一致
    // updatePostContent (withRls transaction)
    mockDbWithSelectAndTransaction([[mockPost]], {
      select: mockTxSelect([mockUser]),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                ...mockPost,
                content: "更新された内容",
                updatedAt: new Date("2026-01-16T00:00:00.000Z"),
              },
            ]),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest(`/api/posts/${POST_ID}`, {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { content: "更新された内容" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Post updated.");
    expect(body.post).toMatchObject({
      id: POST_ID,
      content: "更新された内容",
      songId: SONG_ID,
      userId: USER_ID,
    });
  });

  it("returns 404 when post does not exist", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);
    mockDbWithSelect([]);

    const res = await testRequest(`/api/posts/${NONEXISTENT_ID}`, {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { content: "更新内容" },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Post not found." });
  });

  it("returns 404 when updating another user's post", async () => {
    mockVerifySessionCookie.mockResolvedValue(otherUserSession);

    // selectPostById → 投稿あり（USER_IDの投稿）
    // selectUserByFirebaseId (withRls transaction) → OTHER_USER → 所有者不一致
    mockDbWithSelectAndTransaction([[mockPost]], {
      select: mockTxSelect([mockOtherUser]),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest(`/api/posts/${POST_ID}`, {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { content: "他人の投稿を更新" },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Post not found." });
  });

  it("returns 500 when DB update fails", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    mockDbWithSelectAndTransaction([[mockPost]], {
      select: mockTxSelect([mockUser]),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest(`/api/posts/${POST_ID}`, {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { content: "更新内容" },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Failed to update post." });
  });
});

describe("DELETE /api/posts/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await testRequest(`/api/posts/${POST_ID}`, { method: "DELETE" });

    expect(res.status).toBe(401);
  });

  it("returns 200 on successful soft delete", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    // selectPostById → 投稿あり
    // selectUserByFirebaseId (withRls transaction) → ユーザーあり、所有者一致
    mockDbWithSelectAndTransaction([[mockPost]], {
      select: mockTxSelect([mockUser]),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                ...mockPost,
                deletedAt: new Date("2026-01-16T00:00:00.000Z"),
                updatedAt: new Date("2026-01-16T00:00:00.000Z"),
              },
            ]),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest(`/api/posts/${POST_ID}`, {
      method: "DELETE",
      cookie: { otography_session: "valid-session" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "Post deleted." });
  });

  it("returns 404 when post does not exist", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);
    mockDbWithSelect([]);

    const res = await testRequest(`/api/posts/${NONEXISTENT_ID}`, {
      method: "DELETE",
      cookie: { otography_session: "valid-session" },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Post not found." });
  });

  it("returns 404 when deleting another user's post", async () => {
    mockVerifySessionCookie.mockResolvedValue(otherUserSession);

    // selectPostById → 投稿あり
    // selectUserByFirebaseId (withRls transaction) → OTHER_USER → 所有者不一致
    mockDbWithSelectAndTransaction([[mockPost]], {
      select: mockTxSelect([mockOtherUser]),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest(`/api/posts/${POST_ID}`, {
      method: "DELETE",
      cookie: { otography_session: "valid-session" },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Post not found." });
  });

  it("returns 500 when DB delete fails", async () => {
    mockVerifySessionCookie.mockResolvedValue(validSession);

    mockDbWithSelectAndTransaction([[mockPost]], {
      select: mockTxSelect([mockUser]),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest(`/api/posts/${POST_ID}`, {
      method: "DELETE",
      cookie: { otography_session: "valid-session" },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Failed to delete post." });
  });
});
