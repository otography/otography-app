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

// usecaseをモック
vi.mock("../../../features/post-likes/usecase", () => ({
  toggleLike: vi.fn(),
  getPostLikeCount: vi.fn(),
}));

import { toggleLike } from "../../../features/post-likes/usecase";
import { getAuthSession } from "../../../shared/middleware";

const postId = "6f648f36-5be1-4af1-bf5d-cf8ebf222221";

describe("POST /api/posts/:id/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthSession).mockReturnValue({
      sub: "firebase-uid-123",
      uid: "firebase-uid-123",
      email: "test@example.com",
    } as never);
  });

  it("returns 200 with liked=true and likeCount when toggling on", async () => {
    vi.mocked(toggleLike).mockResolvedValue({ liked: true, likeCount: 1 });

    const res = await testRequest(`/api/posts/${postId}/like`, { method: "POST" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ liked: true, likeCount: 1 });
  });

  it("returns 200 with liked=false and likeCount when toggling off", async () => {
    vi.mocked(toggleLike).mockResolvedValue({ liked: false, likeCount: 0 });

    const res = await testRequest(`/api/posts/${postId}/like`, { method: "POST" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ liked: false, likeCount: 0 });
  });

  it("returns 404 when post not found", async () => {
    const { DbError } = await import("@repo/errors");
    vi.mocked(toggleLike).mockResolvedValue(
      new DbError({ message: "投稿が見つかりません。", statusCode: 404 }),
    );

    const res = await testRequest(`/api/posts/${postId}/like`, { method: "POST" });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "投稿が見つかりません。" });
  });

  it("returns 400 for invalid post id", async () => {
    const res = await testRequest("/api/posts/not-uuid/like", { method: "POST" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid post id." });
  });

  it("returns 401 when session is missing", async () => {
    vi.mocked(getAuthSession).mockReturnValue(null as never);

    const res = await testRequest(`/api/posts/${postId}/like`, { method: "POST" });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "You are not logged in." });
  });

  it("returns 500 when usecase returns DbError with 500", async () => {
    const { DbError } = await import("@repo/errors");
    vi.mocked(toggleLike).mockResolvedValue(
      new DbError({ message: "いいねの操作に失敗しました。" }),
    );

    const res = await testRequest(`/api/posts/${postId}/like`, { method: "POST" });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "いいねの操作に失敗しました。" });
  });
});
