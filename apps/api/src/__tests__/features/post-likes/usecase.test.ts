import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { describe, expect, it, vi } from "vitest";
import { DbError, RlsError } from "@repo/errors";

const mocks = vi.hoisted(() => ({
  togglePostLike: vi.fn(),
  findActivePostById: vi.fn(),
  countPostLikes: vi.fn(),
  withRls: vi.fn(),
}));

vi.mock("../../../shared/db/rls", () => ({
  withRls: mocks.withRls,
}));

vi.mock("../../../features/post-likes/repository", () => ({
  togglePostLike: mocks.togglePostLike,
  findActivePostById: mocks.findActivePostById,
  countPostLikes: mocks.countPostLikes,
}));

import { toggleLike, getPostLikeCount } from "../../../features/post-likes/usecase";

const session = {
  sub: "firebase-user-id",
  uid: "firebase-user-id",
  email: "test@example.com",
} as DecodedIdToken;

const tx = { kind: "transaction" } as never;
const postId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("post-likes usecase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withRls.mockImplementation(async (_session, fn) => await fn(tx, "user-id"));
  });

  describe("toggleLike", () => {
    it("returns liked=true with likeCount when toggling on", async () => {
      mocks.findActivePostById.mockResolvedValue({ id: postId });
      mocks.togglePostLike.mockResolvedValue({ liked: true });
      mocks.countPostLikes.mockResolvedValue(1);

      const result = await toggleLike(session, postId);

      expect(result).toEqual({ liked: true, likeCount: 1 });
    });

    it("returns liked=false with likeCount when toggling off", async () => {
      mocks.findActivePostById.mockResolvedValue({ id: postId });
      mocks.togglePostLike.mockResolvedValue({ liked: false });
      mocks.countPostLikes.mockResolvedValue(0);

      const result = await toggleLike(session, postId);

      expect(result).toEqual({ liked: false, likeCount: 0 });
    });

    it("returns 404 DbError when post not found", async () => {
      mocks.findActivePostById.mockResolvedValue(null);

      const result = await toggleLike(session, postId);

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "投稿が見つかりません。",
        statusCode: 404,
      });
    });

    it("wraps RLS failures as DbError", async () => {
      const cause = new RlsError({ message: "User not found in database." });
      mocks.findActivePostById.mockResolvedValue({ id: postId });
      mocks.withRls.mockResolvedValue(cause);

      const result = await toggleLike(session, postId);

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "いいねの操作に失敗しました。",
        statusCode: 500,
        cause,
      });
    });
  });

  describe("getPostLikeCount", () => {
    it("returns like count for a post", async () => {
      mocks.countPostLikes.mockResolvedValue(42);

      const result = await getPostLikeCount(postId);

      expect(result).toEqual({ likeCount: 42 });
    });

    it("wraps repository errors as DbError", async () => {
      mocks.countPostLikes.mockResolvedValue(new DbError({ message: "Count failed." }));

      const result = await getPostLikeCount(postId);

      expect(result).toBeInstanceOf(DbError);
    });
  });
});
