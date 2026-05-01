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
vi.mock("../../../features/favorite-artists/usecase", () => ({
  getFavoriteArtists: vi.fn(),
  getPublicFavoriteArtists: vi.fn(),
  registerFavoriteArtist: vi.fn(),
  deleteFavoriteArtist: vi.fn(),
}));

import {
  getFavoriteArtists,
  getPublicFavoriteArtists,
  registerFavoriteArtist,
  deleteFavoriteArtist,
} from "../../../features/favorite-artists/usecase";

import { getAuthSession } from "../../../shared/middleware";

const mockFavoriteArtist = {
  userId: "user-uuid-1",
  artistId: "artist-uuid-1",
  comment: "最高!",
  emoji: "🎸",
  color: "#0000ff",
  createdAt: new Date("2026-04-30T00:00:00.000Z"),
  updatedAt: new Date("2026-04-30T00:00:00.000Z"),
};

const mockArtist = {
  id: "artist-uuid-1",
  name: "テストアーティスト",
  appleMusicId: "am-artist-123",
};

// usecase が返す変換後の期待フォーマット
// addedAt は Date 型だが JSON レスポンスでは ISO 文字列になる
const expectedFavoriteItem = {
  artist: mockArtist,
  comment: mockFavoriteArtist.comment as string | null,
  emoji: mockFavoriteArtist.emoji as string | null,
  color: mockFavoriteArtist.color as string | null,
  addedAt: mockFavoriteArtist.createdAt,
};

describe("Favorite Artists endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthSession).mockReturnValue({
      sub: "firebase-uid-123",
      uid: "firebase-uid-123",
      email: "test@example.com",
    } as never);
  });

  describe("GET /api/me/favorites/artists", () => {
    it("returns 200 with favorites list", async () => {
      vi.mocked(getFavoriteArtists).mockResolvedValue({
        favorites: [expectedFavoriteItem],
      });

      const res = await testRequest("/api/me/favorites/artists");

      expect(res.status).toBe(200);
      const json = (await res.json()) as { favorites: unknown[] };
      const item = json.favorites[0] as Record<string, unknown>;
      expect(item).toMatchObject({
        artist: mockArtist,
        comment: mockFavoriteArtist.comment,
        emoji: mockFavoriteArtist.emoji,
        color: mockFavoriteArtist.color,
      });
      expect(typeof item.addedAt).toBe("string");
    });

    it("returns 500 when usecase returns DbError", async () => {
      const { DbError } = await import("@repo/errors");
      vi.mocked(getFavoriteArtists).mockResolvedValue(
        new DbError({ message: "お気に入りアーティストの取得に失敗しました。" }),
      );

      const res = await testRequest("/api/me/favorites/artists");

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        message: "お気に入りアーティストの取得に失敗しました。",
      });
    });

    it("returns 401 when session is null", async () => {
      vi.mocked(getAuthSession).mockReturnValue(null as never);

      const res = await testRequest("/api/me/favorites/artists");

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ message: "ログインしていません。" });
    });
  });

  describe("GET /api/users/:userId/favorites/artists", () => {
    it("returns 200 with public favorites", async () => {
      vi.mocked(getPublicFavoriteArtists).mockResolvedValue({
        favorites: [expectedFavoriteItem],
      });

      const res = await testRequest(
        "/api/users/8f648f36-5be1-4af1-bf5d-cf8ebf211111/favorites/artists",
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { favorites: unknown[] };
      const item = json.favorites[0] as Record<string, unknown>;
      expect(item).toMatchObject({
        artist: mockArtist,
        comment: mockFavoriteArtist.comment,
        emoji: mockFavoriteArtist.emoji,
        color: mockFavoriteArtist.color,
      });
      expect(typeof item.addedAt).toBe("string");
    });

    it("returns 400 for invalid userId", async () => {
      const res = await testRequest("/api/users/not-uuid/favorites/artists");

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ message: "無効なユーザーIDです。" });
    });

    it("returns 500 when usecase returns DbError", async () => {
      const { DbError } = await import("@repo/errors");
      vi.mocked(getPublicFavoriteArtists).mockResolvedValue(
        new DbError({ message: "お気に入りアーティストの取得に失敗しました。" }),
      );

      const res = await testRequest(
        "/api/users/8f648f36-5be1-4af1-bf5d-cf8ebf211111/favorites/artists",
      );

      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/me/favorites/artists", () => {
    it("returns 201 with created favorite", async () => {
      vi.mocked(registerFavoriteArtist).mockResolvedValue({
        favorite: mockFavoriteArtist,
      });

      const res = await testRequest("/api/me/favorites/artists", {
        method: "POST",
        body: {
          appleMusicId: "am-artist-123",
          comment: "最高!",
        },
      });

      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({
        favorite: {
          userId: mockFavoriteArtist.userId,
          artistId: mockFavoriteArtist.artistId,
          comment: mockFavoriteArtist.comment,
          emoji: mockFavoriteArtist.emoji,
          color: mockFavoriteArtist.color,
        },
      });
    });

    it("returns 409 on duplicate favorite", async () => {
      const { DbError } = await import("@repo/errors");
      vi.mocked(registerFavoriteArtist).mockResolvedValue(
        new DbError({
          message: "このアーティストは既にお気に入りに登録されています。",
          statusCode: 409,
        }),
      );

      const res = await testRequest("/api/me/favorites/artists", {
        method: "POST",
        body: {
          appleMusicId: "am-artist-123",
        },
      });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        message: "このアーティストは既にお気に入りに登録されています。",
      });
    });

    it("returns 502 when Apple Music API fails", async () => {
      const { DbError } = await import("@repo/errors");
      vi.mocked(registerFavoriteArtist).mockResolvedValue(
        new DbError({
          message: "Apple Music API のリクエストに失敗しました。",
          statusCode: 502,
        }),
      );

      const res = await testRequest("/api/me/favorites/artists", {
        method: "POST",
        body: {
          appleMusicId: "am-artist-123",
        },
      });

      expect(res.status).toBe(502);
    });

    it("returns 400 for invalid payload", async () => {
      const res = await testRequest("/api/me/favorites/artists", {
        method: "POST",
        body: {},
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ message: "リクエストが不正です。" });
    });

    it("returns 401 when session is null", async () => {
      vi.mocked(getAuthSession).mockReturnValue(null as never);

      const res = await testRequest("/api/me/favorites/artists", {
        method: "POST",
        body: { appleMusicId: "am-artist-123" },
      });

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/me/favorites/artists/:appleMusicId", () => {
    it("returns 204 on successful delete", async () => {
      vi.mocked(deleteFavoriteArtist).mockResolvedValue({ deleted: true });

      const res = await testRequest("/api/me/favorites/artists/am-artist-123", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });

    it("returns 404 when favorite not found", async () => {
      const { DbError } = await import("@repo/errors");
      vi.mocked(deleteFavoriteArtist).mockResolvedValue(
        new DbError({
          message: "お気に入りアーティストが見つかりません。",
          statusCode: 404,
        }),
      );

      const res = await testRequest("/api/me/favorites/artists/am-artist-999", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ message: "お気に入りアーティストが見つかりません。" });
    });

    it("returns 401 when session is null", async () => {
      vi.mocked(getAuthSession).mockReturnValue(null as never);

      const res = await testRequest("/api/me/favorites/artists/am-artist-123", {
        method: "DELETE",
      });

      expect(res.status).toBe(401);
    });
  });
});
