import { describe, expect, it, vi } from "vitest";
import { testRequest } from "../../helpers/test-client";

/*
 * テストリスト: post-likes ルート ドメイン固有 problem type URI 移行
 *
 * 以下のテスト期待値を更新してドメイン固有 problem type URI を検証:
 * 1. POST /api/posts/:id/like → 404 (投稿なし) → type: .../post-not-found
 * 2. POST /api/posts/:id/like → 400 (不正な id) → bad-request（変更なし）
 * 3. POST /api/posts/:id/like → 500 (DB エラー) → internal-error（変更なし）
 * 4. 成功レスポンスの形式は変更なし
 */

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

// auth-sessionもモック - rateLimitByUserミドルウェアが直接インポートするため
vi.mock("../../../shared/auth/auth-session", () => ({
  getAuthSession: vi.fn(() => ({
    sub: "firebase-uid-123",
    uid: "firebase-uid-123",
    email: "test@example.com",
  })),
}));

// usecaseをモック
vi.mock("../../../features/post-likes/usecase", () => ({
  toggleLike: vi.fn(),
}));

import { toggleLike } from "../../../features/post-likes/usecase";
import { getAuthSession } from "../../../shared/auth/auth-session";

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
    expect(await res.json()).toMatchObject({ liked: true, likeCount: 1 });
  });

  it("returns 200 with liked=false and likeCount when toggling off", async () => {
    vi.mocked(toggleLike).mockResolvedValue({ liked: false, likeCount: 0 });

    const res = await testRequest(`/api/posts/${postId}/like`, { method: "POST" });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ liked: false, likeCount: 0 });
  });

  it("returns 404 when post not found", async () => {
    const { DbError } = await import("@repo/errors");
    vi.mocked(toggleLike).mockResolvedValue(
      new DbError({
        message: "投稿が見つかりません。",
        statusCode: 404,
        problemSlug: "post-not-found",
      }),
    );

    const res = await testRequest(`/api/posts/${postId}/like`, { method: "POST" });

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/post-not-found",
      title: "Post Not Found",
      status: 404,
      detail: "投稿が見つかりません。",
    });
  });

  it("returns 400 for invalid post id", async () => {
    const res = await testRequest("/api/posts/not-uuid/like", { method: "POST" });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/bad-request",
      title: "Bad Request",
      status: 400,
      detail: "Please provide a valid post id.",
    });
  });

  it("returns 401 when session is missing", async () => {
    vi.mocked(getAuthSession).mockReturnValue(null as never);

    const res = await testRequest(`/api/posts/${postId}/like`, { method: "POST" });

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "You are not logged in.",
    });
  });

  it("returns 500 when usecase returns DbError with 500", async () => {
    const { DbError } = await import("@repo/errors");
    vi.mocked(toggleLike).mockResolvedValue(
      new DbError({ message: "いいねの操作に失敗しました。" }),
    );

    const res = await testRequest(`/api/posts/${postId}/like`, { method: "POST" });

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/internal-error",
      title: "Internal Server Error",
      status: 500,
      detail: "いいねの操作に失敗しました。",
    });
  });
});
