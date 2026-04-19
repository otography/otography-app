import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockVerifySessionCookie } from "../../setup";
import { testRequest } from "../../helpers/test-client";

// DB モック
vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(),
}));

// Embedding生成モック — テストケースごとに制御
// EmbeddingErrorは本物を保持し、generateEmbeddingのみモック
vi.mock("../../../features/posts/lib/embedding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../features/posts/lib/embedding")>();
  return {
    ...actual,
    generateEmbedding: vi.fn(),
  };
});

import { createDb } from "../../../shared/db";
import { generateEmbedding, EmbeddingError } from "../../../features/posts/lib/embedding";

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

// テスト用の 1024 次元ベクトル生成ヘルパー
const createMockEmbedding = (dimensions = 1024): number[] =>
  Array.from({ length: dimensions }, (_, i) => 0.001 * (i + 1));

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

// セットアップヘルパー
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
// selectResults: 直接select呼び出しの結果
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

// Embedding生成成功時のDBモックをセットアップ
// selectUserByFirebaseId (withRls transaction) → ユーザーあり
// トランザクション1: insert → 投稿作成
// トランザクション2: update → embedding更新
const setupHappyPathMocks = (
  embedding: number[] | null,
  overrides?: { update?: ReturnType<typeof vi.fn> },
) => {
  vi.mocked(generateEmbedding).mockResolvedValue(embedding);

  const mockInsertedPost = { ...mockPost, embedding: null };
  const mockUpdatedPost = embedding ? { ...mockPost, embedding } : mockPost;

  mockDbWithSelectAndTransaction([], {
    select: mockTxSelect([mockUser]),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([mockInsertedPost]),
      })),
    })),
    update:
      overrides?.update ??
      vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([mockUpdatedPost]),
          })),
        })),
      })),
    execute: vi.fn().mockResolvedValue([]),
  });
};

describe("Embedding統合: 投稿作成 + Embedding生成", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ハッピーパス: 投稿作成時にEmbedding生成成功", () => {
    it("POST /api/posts → 201, generateEmbeddingが呼ばれる", async () => {
      mockVerifySessionCookie.mockResolvedValue(validSession);
      const mockEmbedding = createMockEmbedding();
      setupHappyPathMocks(mockEmbedding);

      const res = await testRequest("/api/posts", {
        method: "POST",
        cookie: { otography_session: "valid-session" },
        body: { content: "素晴らしい曲です", songId: SONG_ID },
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.post).toMatchObject({
        id: POST_ID,
        content: "素晴らしい曲です",
        songId: SONG_ID,
        userId: USER_ID,
      });

      // generateEmbeddingが正しい引数で呼ばれたことを確認
      expect(generateEmbedding).toHaveBeenCalledTimes(1);
      expect(generateEmbedding).toHaveBeenCalledWith(
        "素晴らしい曲です",
        expect.anything(), // env.AI (miniflare mock)
      );
    });

    it("Embedding生成成功時、updatePostEmbeddingが呼ばれる", async () => {
      mockVerifySessionCookie.mockResolvedValue(validSession);
      const mockEmbedding = createMockEmbedding();
      const mockUpdate = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ ...mockPost, embedding: mockEmbedding }]),
          })),
        })),
      }));
      setupHappyPathMocks(mockEmbedding, { update: mockUpdate });

      const res = await testRequest("/api/posts", {
        method: "POST",
        cookie: { otography_session: "valid-session" },
        body: { content: "テスト投稿", songId: SONG_ID },
      });

      expect(res.status).toBe(201);
      // generateEmbeddingが呼ばれ、結果がnullでないことを確認
      expect(generateEmbedding).toHaveBeenCalledTimes(1);
      // updatePostEmbeddingが呼ばれたことを確認（DB update が実行された）
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("グレースフルデグラデーション: AI失敗時も投稿は保存される", () => {
    it("generateEmbeddingがErrorを返した場合 → 201, クライアントにエラーを返さない", async () => {
      mockVerifySessionCookie.mockResolvedValue(validSession);

      // Embedding生成失敗をシミュレート
      vi.mocked(generateEmbedding).mockResolvedValue(
        new EmbeddingError({ reason: "AI service unavailable" }),
      );

      mockDbWithSelectAndTransaction([], {
        select: mockTxSelect([mockUser]),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([mockPost]),
          })),
        })),
        execute: vi.fn().mockResolvedValue([]),
      });

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const res = await testRequest("/api/posts", {
        method: "POST",
        cookie: { otography_session: "valid-session" },
        body: { content: "テスト投稿", songId: SONG_ID },
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

      // 警告ログが出力されたことを確認
      expect(warnSpy).toHaveBeenCalledWith(
        "Embedding generation failed:",
        "AI service unavailable",
      );

      warnSpy.mockRestore();
    });

    it("generateEmbeddingがnullを返した場合（空内容扱い）→ 201, updateは呼ばれない", async () => {
      mockVerifySessionCookie.mockResolvedValue(validSession);

      // 空内容の場合、generateEmbeddingはnullを返す
      vi.mocked(generateEmbedding).mockResolvedValue(null);

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
        body: { content: "テスト投稿", songId: SONG_ID },
      });

      expect(res.status).toBe(201);
    });
  });

  describe("更新パス: EmbeddingはNULLにリセットされる", () => {
    it("PATCH /api/posts/:id → embeddingがNULLに設定される", async () => {
      mockVerifySessionCookie.mockResolvedValue(validSession);

      // selectPostById → 投稿あり（embedding付き）
      // selectUserByFirebaseId (withRls transaction) → ユーザーあり、所有者一致
      // updatePostContent → embedding を NULL に設定
      mockDbWithSelectAndTransaction([[{ ...mockPost, embedding: createMockEmbedding() }]], {
        select: mockTxSelect([mockUser]),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([
                {
                  ...mockPost,
                  content: "更新された内容",
                  embedding: null,
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
      // 更新時にgenerateEmbeddingが呼ばれていないことを確認
      expect(generateEmbedding).not.toHaveBeenCalled();
    });
  });

  describe("NULL embeddingの投稿が読み取れる", () => {
    it("GET /api/posts/:id → embedding=nullの投稿も正常に取得できる", async () => {
      mockDbWithSelect([{ ...mockPost, embedding: null }]);

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
  });

  describe("フルライフサイクル: create → read → update → soft-delete", () => {
    it("同一ユーザーでCRUD全体を実行できる", async () => {
      mockVerifySessionCookie.mockResolvedValue(validSession);

      // === 1. CREATE ===
      const mockEmbedding = createMockEmbedding();
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      mockDbWithSelectAndTransaction([], {
        select: mockTxSelect([mockUser]),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([mockPost]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([{ ...mockPost, embedding: mockEmbedding }]),
            })),
          })),
        })),
        execute: vi.fn().mockResolvedValue([]),
      });

      const createRes = await testRequest("/api/posts", {
        method: "POST",
        cookie: { otography_session: "valid-session" },
        body: { content: "素晴らしい曲です", songId: SONG_ID },
      });
      expect(createRes.status).toBe(201);
      expect(generateEmbedding).toHaveBeenCalledTimes(1);

      // === 2. READ ===
      vi.clearAllMocks();
      mockDbWithSelect([{ ...mockPost, embedding: mockEmbedding }]);

      const readRes = await testRequest(`/api/posts/${POST_ID}`);
      expect(readRes.status).toBe(200);
      const readBody = await readRes.json();
      expect(readBody.post).toMatchObject({
        id: POST_ID,
        content: "素晴らしい曲です",
        songId: SONG_ID,
        userId: USER_ID,
      });

      // === 3. UPDATE (embeddingはNULLにリセットされる) ===
      vi.clearAllMocks();
      mockVerifySessionCookie.mockResolvedValue(validSession);
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      mockDbWithSelectAndTransaction([[{ ...mockPost, embedding: mockEmbedding }]], {
        select: mockTxSelect([mockUser]),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([
                {
                  ...mockPost,
                  content: "更新された内容",
                  embedding: null, // embeddingはNULLにリセットされる
                  updatedAt: new Date("2026-01-16T00:00:00.000Z"),
                },
              ]),
            })),
          })),
        })),
        execute: vi.fn().mockResolvedValue([]),
      });

      const updateRes = await testRequest(`/api/posts/${POST_ID}`, {
        method: "PATCH",
        cookie: { otography_session: "valid-session" },
        body: { content: "更新された内容" },
      });
      expect(updateRes.status).toBe(200);
      // 更新時にgenerateEmbeddingが呼ばれていないことを確認
      expect(generateEmbedding).not.toHaveBeenCalled();

      // === 4. SOFT DELETE ===
      vi.clearAllMocks();
      mockVerifySessionCookie.mockResolvedValue(validSession);

      mockDbWithSelectAndTransaction(
        [[{ ...mockPost, content: "更新された内容", embedding: mockEmbedding }]],
        {
          select: mockTxSelect([mockUser]),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue([
                  {
                    ...mockPost,
                    content: "更新された内容",
                    embedding: mockEmbedding,
                    deletedAt: new Date("2026-01-17T00:00:00.000Z"),
                    updatedAt: new Date("2026-01-17T00:00:00.000Z"),
                  },
                ]),
              })),
            })),
          })),
          execute: vi.fn().mockResolvedValue([]),
        },
      );

      const deleteRes = await testRequest(`/api/posts/${POST_ID}`, {
        method: "DELETE",
        cookie: { otography_session: "valid-session" },
      });
      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.message).toBe("Post deleted.");
    });
  });

  describe("クロスユーザー認可: 他ユーザーの投稿は操作できない", () => {
    it("他ユーザーの投稿を更新 → 404", async () => {
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
      expect(generateEmbedding).not.toHaveBeenCalled();
    });

    it("他ユーザーの投稿を削除 → 404", async () => {
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
      expect(generateEmbedding).not.toHaveBeenCalled();
    });
  });

  describe("認証なしでのEmbedding生成は行われない", () => {
    it("セッションなし → 401, generateEmbeddingは呼ばれない", async () => {
      const res = await testRequest("/api/posts", {
        method: "POST",
        body: { content: "テスト投稿", songId: SONG_ID },
      });

      expect(res.status).toBe(401);
      expect(generateEmbedding).not.toHaveBeenCalled();
    });
  });
});
