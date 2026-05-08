import { type Context } from "hono";
import { describe, expect, it, vi } from "vitest";
import { testRequest } from "../../helpers/test-client";

/*
 * テストリスト: favorite-songs ルート RFC 7807 移行
 *
 * 以下の既存テスト期待値を { message } から RFC 7807 ProblemDetails に更新:
 * 1. GET /api/me/favorites/songs → 500 (DbError) → internal-error
 * 2. GET /api/me/favorites/songs → 401 (null session) → unauthorized
 * 3. GET /api/users/:userId/favorites/songs → 400 (invalid userId) → bad-request
 * 4. POST /api/me/favorites/songs → 409 (duplicate) → conflict
 * 5. POST /api/me/favorites/songs → 400 (invalid payload) → bad-request
 * 6. DELETE /api/me/favorites/songs/:appleMusicId → 404 (not found) → not-found
 * 7. 成功レスポンスの形式は変更なし
 */

// ミドルウェアをモック（CSRF・認証をバイパス）
vi.mock("../../../shared/middleware", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/middleware")>(
    "../../../shared/middleware",
  );

  // モック内で共有する getAuthSession モック
  // rateLimitByUser モックがセッション状態を参照できるように、
  // vi.fn() のクロージャでミュータブルなオブジェクトとして定義
  const mockGetAuthSession = vi.fn((_c: unknown) => ({
    sub: "firebase-uid-123",
    uid: "firebase-uid-123",
    email: "test@example.com",
  }));

  return {
    ...actual,
    csrfProtection: () => async (_c: unknown, next: () => Promise<void>) => await next(),
    requireAuthMiddleware: () => async (_c: unknown, next: () => Promise<void>) => await next(),
    // rateLimitByUser をモック: セッションがあれば next()、なければ 401
    rateLimitByUser: () => async (c: Context, next: () => Promise<void>) => {
      const session = mockGetAuthSession(c);
      if (!session) {
        return c.body(
          JSON.stringify({
            type: "https://api.otography.com/errors/unauthorized",
            title: "Unauthorized",
            status: 401,
            detail: "You are not logged in.",
          }),
          401,
          { "Content-Type": "application/problem+json" },
        );
      }
      await next();
    },
    getAuthSession: mockGetAuthSession,
  };
});

// usecase をモック
vi.mock("../../../features/favorite-songs/usecase", () => ({
  getFavoriteSongs: vi.fn(),
  getPublicFavoriteSongs: vi.fn(),
  registerFavoriteSong: vi.fn(),
  deleteFavoriteSong: vi.fn(),
}));

import {
  getFavoriteSongs,
  getPublicFavoriteSongs,
  registerFavoriteSong,
  deleteFavoriteSong,
} from "../../../features/favorite-songs/usecase";

import { getAuthSession } from "../../../shared/middleware";

const mockFavoriteSong = {
  userId: "user-uuid-1",
  songId: "song-uuid-1",
  comment: "好き!",
  emoji: "🎵",
  color: "#ff0000",
  createdAt: "2026-04-30T00:00:00.000Z",
};

const mockSong = {
  id: "song-uuid-1",
  title: "テスト楽曲",
  appleMusicId: "am-song-123",
};

// usecase が返す変換後の期待フォーマット
// addedAt は文字列型（Drizzle の mode: "string" 設定により）
const expectedFavoriteItem = {
  song: mockSong,
  comment: mockFavoriteSong.comment as string | null,
  emoji: mockFavoriteSong.emoji as string | null,
  color: mockFavoriteSong.color as string | null,
  addedAt: mockFavoriteSong.createdAt,
};

describe("Favorite Songs endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthSession).mockReturnValue({
      sub: "firebase-uid-123",
      uid: "firebase-uid-123",
      email: "test@example.com",
    } as never);
  });

  describe("GET /api/me/favorites/songs", () => {
    it("returns 200 with favorites list", async () => {
      vi.mocked(getFavoriteSongs).mockResolvedValue({
        favorites: [expectedFavoriteItem],
        pagination: { hasNext: false, nextCursor: null },
      });

      const res = await testRequest("/api/me/favorites/songs");

      expect(res.status).toBe(200);
      const json = (await res.json()) as { favorites: unknown[] };
      const item = json.favorites[0] as Record<string, unknown>;
      expect(item).toMatchObject({
        song: mockSong,
        comment: mockFavoriteSong.comment,
        emoji: mockFavoriteSong.emoji,
        color: mockFavoriteSong.color,
      });
      expect(typeof item.addedAt).toBe("string");
    });

    it("returns 500 when usecase returns DbError", async () => {
      const { DbError } = await import("@repo/errors");
      vi.mocked(getFavoriteSongs).mockResolvedValue(
        new DbError({ message: "お気に入り楽曲の取得に失敗しました。" }),
      );

      const res = await testRequest("/api/me/favorites/songs");

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        type: "https://api.otography.com/errors/internal-error",
        title: "Internal Server Error",
        status: 500,
        detail: "お気に入り楽曲の取得に失敗しました。",
      });
    });

    it("returns 401 when session is null", async () => {
      vi.mocked(getAuthSession).mockReturnValue(null as never);

      const res = await testRequest("/api/me/favorites/songs");

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        type: "https://api.otography.com/errors/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: "ログインしていません。",
      });
    });
  });

  describe("GET /api/users/:userId/favorites/songs", () => {
    it("returns 200 with public favorites", async () => {
      vi.mocked(getPublicFavoriteSongs).mockResolvedValue({
        favorites: [expectedFavoriteItem],
        pagination: { hasNext: false, nextCursor: null },
      });

      const res = await testRequest(
        "/api/users/8f648f36-5be1-4af1-bf5d-cf8ebf211111/favorites/songs",
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { favorites: unknown[] };
      const item = json.favorites[0] as Record<string, unknown>;
      expect(item).toMatchObject({
        song: mockSong,
        comment: mockFavoriteSong.comment,
        emoji: mockFavoriteSong.emoji,
        color: mockFavoriteSong.color,
      });
      expect(typeof item.addedAt).toBe("string");
    });

    it("returns 400 for invalid userId", async () => {
      const res = await testRequest("/api/users/not-uuid/favorites/songs");

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        type: "https://api.otography.com/errors/bad-request",
        title: "Bad Request",
        status: 400,
        detail: "無効なユーザーIDです。",
      });
    });

    it("returns 500 when usecase returns DbError", async () => {
      const { DbError } = await import("@repo/errors");
      vi.mocked(getPublicFavoriteSongs).mockResolvedValue(
        new DbError({ message: "お気に入り楽曲の取得に失敗しました。" }),
      );

      const res = await testRequest(
        "/api/users/8f648f36-5be1-4af1-bf5d-cf8ebf211111/favorites/songs",
      );

      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/me/favorites/songs", () => {
    it("returns 201 with created favorite", async () => {
      vi.mocked(registerFavoriteSong).mockResolvedValue({
        favorite: mockFavoriteSong,
      });

      const res = await testRequest("/api/me/favorites/songs", {
        method: "POST",
        body: {
          appleMusicId: "am-song-123",
          comment: "好き!",
        },
      });

      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({
        favorite: {
          userId: mockFavoriteSong.userId,
          songId: mockFavoriteSong.songId,
          comment: mockFavoriteSong.comment,
          emoji: mockFavoriteSong.emoji,
          color: mockFavoriteSong.color,
        },
      });
    });

    it("returns 409 on duplicate favorite", async () => {
      const { DbError } = await import("@repo/errors");
      vi.mocked(registerFavoriteSong).mockResolvedValue(
        new DbError({
          message: "この楽曲は既にお気に入りに登録されています。",
          statusCode: 409,
        }),
      );

      const res = await testRequest("/api/me/favorites/songs", {
        method: "POST",
        body: {
          appleMusicId: "am-song-123",
        },
      });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        type: "https://api.otography.com/errors/conflict",
        title: "Conflict",
        status: 409,
        detail: "この楽曲は既にお気に入りに登録されています。",
      });
    });

    it("returns 502 when Apple Music API fails", async () => {
      const { DbError } = await import("@repo/errors");
      vi.mocked(registerFavoriteSong).mockResolvedValue(
        new DbError({
          message: "Apple Music API のリクエストに失敗しました。",
          statusCode: 502,
        }),
      );

      const res = await testRequest("/api/me/favorites/songs", {
        method: "POST",
        body: {
          appleMusicId: "am-song-123",
        },
      });

      expect(res.status).toBe(502);
    });

    it("returns 400 for invalid payload", async () => {
      const res = await testRequest("/api/me/favorites/songs", {
        method: "POST",
        body: {},
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        type: "https://api.otography.com/errors/bad-request",
        title: "Bad Request",
        status: 400,
        detail: "リクエストが不正です。",
      });
    });

    it("returns 401 when session is null", async () => {
      vi.mocked(getAuthSession).mockReturnValue(null as never);

      const res = await testRequest("/api/me/favorites/songs", {
        method: "POST",
        body: { appleMusicId: "am-song-123" },
      });

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/me/favorites/songs/:appleMusicId", () => {
    it("returns 204 on successful delete", async () => {
      vi.mocked(deleteFavoriteSong).mockResolvedValue({ deleted: true });

      const res = await testRequest("/api/me/favorites/songs/am-song-123", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });

    it("returns 404 when favorite not found", async () => {
      const { DbError } = await import("@repo/errors");
      vi.mocked(deleteFavoriteSong).mockResolvedValue(
        new DbError({
          message: "お気に入り楽曲が見つかりません。",
          statusCode: 404,
        }),
      );

      const res = await testRequest("/api/me/favorites/songs/am-song-999", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        type: "https://api.otography.com/errors/not-found",
        title: "Not Found",
        status: 404,
        detail: "お気に入り楽曲が見つかりません。",
      });
    });

    it("returns 404 for invalid appleMusicId", async () => {
      const res = await testRequest("/api/me/favorites/songs/", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("returns 401 when session is null", async () => {
      vi.mocked(getAuthSession).mockReturnValue(null as never);

      const res = await testRequest("/api/me/favorites/songs/am-song-123", {
        method: "DELETE",
      });

      expect(res.status).toBe(401);
    });
  });
});
