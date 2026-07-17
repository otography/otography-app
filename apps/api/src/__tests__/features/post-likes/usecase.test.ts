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
  countPostLikes: mocks.countPostLikes,
}));

vi.mock("../../../features/posts/repository", () => ({
  findActivePostById: mocks.findActivePostById,
}));

import { toggleLike } from "../../../features/post-likes/usecase";

const session = {
  sub: "firebase-user-id",
  uid: "firebase-user-id",
  email: "test@example.com",
} as DecodedIdToken;

const db = { kind: "db" } as never;
const tx = { kind: "transaction" } as never;
const postId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("post-likes usecase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withRls.mockImplementation(async (_db, _session, fn) => await fn(tx, "user-id"));
  });

  describe("toggleLike", () => {
    it("returns liked=true with likeCount when toggling on", async () => {
      mocks.findActivePostById.mockResolvedValue({ id: postId });
      mocks.togglePostLike.mockResolvedValue({ liked: true });
      mocks.countPostLikes.mockResolvedValue(1);

      const result = await toggleLike(session, postId, db);

      expect(result).toEqual({ liked: true, likeCount: 1 });
    });

    it("returns liked=false with likeCount when toggling off", async () => {
      mocks.findActivePostById.mockResolvedValue({ id: postId });
      mocks.togglePostLike.mockResolvedValue({ liked: false });
      mocks.countPostLikes.mockResolvedValue(0);

      const result = await toggleLike(session, postId, db);

      expect(result).toEqual({ liked: false, likeCount: 0 });
    });

    it("returns 404 DbError when post not found", async () => {
      mocks.findActivePostById.mockResolvedValue(null);

      const result = await toggleLike(session, postId, db);

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "投稿が見つかりません。",
        statusCode: 404,
      });
      // 存在確認はトランザクション内
      expect(mocks.findActivePostById).toHaveBeenCalledWith(tx, postId);
    });

    it("calls all operations within the same withRls transaction", async () => {
      mocks.findActivePostById.mockResolvedValue({ id: postId });
      mocks.togglePostLike.mockResolvedValue({ liked: true });
      mocks.countPostLikes.mockResolvedValue(3);

      const result = await toggleLike(session, postId, db);

      expect(result).toEqual({ liked: true, likeCount: 3 });
      // 全操作が tx に対して実行される
      expect(mocks.findActivePostById).toHaveBeenCalledWith(tx, postId);
      expect(mocks.togglePostLike).toHaveBeenCalledWith(tx, "user-id", postId);
      expect(mocks.countPostLikes).toHaveBeenCalledWith(tx, postId);
    });

    it("wraps RLS failures as DbError", async () => {
      const cause = new RlsError({ message: "User not found in database." });
      mocks.withRls.mockResolvedValue(cause);

      const result = await toggleLike(session, postId, db);

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "いいねの操作に失敗しました。",
        statusCode: 500,
        cause,
      });
    });
  });
});
