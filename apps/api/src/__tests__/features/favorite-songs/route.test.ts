import { describe, expect, it, vi } from "vitest";
import { testRequest } from "../../helpers/test-client";

// ミドルウェアをモック（CSRF・認証をバイパス）
vi.mock("../../../shared/middleware", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/middleware")>(
    "../../../shared/middleware",
  );

  return {
    ...actual,
    csrfProtection: () => async (_c: unknown, next: () => Promise<void>) => await next(),
    requireAuthMiddleware: () => async (_c: unknown, next: () => Promise<void>) => await next(),
    getAuthSession: vi.fn(() => ({
      sub: "firebase-uid-123",
      uid: "firebase-uid-123",
      email: "test@example.com",
    })),
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
  createdAt: new Date("2026-04-30T00:00:00.000Z"),
};

const mockSong = {
  id: "song-uuid-1",
  title: "テスト楽曲",
  appleMusicId: "am-song-123",
};

// usecase が返す変換後の期待フォーマット
// addedAt は Date 型だが JSON レスポンスでは ISO 文字列になる
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
        message: "お気に入り楽曲の取得に失敗しました。",
      });
    });

    it("returns 401 when session is null", async () => {
      vi.mocked(getAuthSession).mockReturnValue(null as never);

      const res = await testRequest("/api/me/favorites/songs");

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ message: "ログインしていません。" });
    });
  });

  describe("GET /api/users/:userId/favorites/songs", () => {
    it("returns 200 with public favorites", async () => {
      vi.mocked(getPublicFavoriteSongs).mockResolvedValue({
        favorites: [expectedFavoriteItem],
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
      expect(await res.json()).toEqual({ message: "無効なユーザーIDです。" });
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
        message: "この楽曲は既にお気に入りに登録されています。",
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
      expect(await res.json()).toEqual({ message: "リクエストが不正です。" });
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
      expect(await res.json()).toEqual({ message: "お気に入り楽曲が見つかりません。" });
    });

    it("returns 400 for invalid appleMusicId", async () => {
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
