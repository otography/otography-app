import { describe, expect, it, vi } from "vitest";
import {
  togglePostLike,
  countLikesByPostIds,
  findUserLikesByPostIds,
} from "../../../features/post-likes/repository";

const postId = "6f648f36-5be1-4af1-bf5d-cf8ebf222221";
const userId = "7f648f36-5be1-4af1-bf5d-cf8ebf222220";

describe("post-likes repository", () => {
  describe("togglePostLike", () => {
    it("deletes the like and returns liked=false when already liked", async () => {
      // 既存あり → DELETE → liked=false
      const deleteReturning = vi.fn().mockResolvedValue([{ userId, postId }]);
      const deleteWhere = vi.fn(() => ({ returning: deleteReturning }));
      const del = vi.fn(() => ({ where: deleteWhere }));
      // select で既存レコードを返す
      const selectLimit = vi.fn().mockResolvedValue([{ userId, postId }]);
      const selectWhere = vi.fn(() => ({ limit: selectLimit }));
      const selectFrom = vi.fn(() => ({ where: selectWhere }));
      const select = vi.fn(() => ({ from: selectFrom }));
      const tx = { select, delete: del } as never;

      const result = await togglePostLike(tx, userId, postId);

      expect(result).toEqual({ liked: false });
      expect(del).toHaveBeenCalled();
    });

    it("returns liked=true when no existing like found and insert succeeds", async () => {
      // select → 空配列 → insert
      const selectLimit = vi.fn().mockResolvedValue([]);
      const selectWhere = vi.fn(() => ({ limit: selectLimit }));
      const selectFrom = vi.fn(() => ({ where: selectWhere }));
      const select = vi.fn(() => ({ from: selectFrom }));

      const insertReturning = vi.fn().mockResolvedValue([{ userId, postId }]);
      const insertValues = vi.fn(() => ({ returning: insertReturning }));
      const insert = vi.fn(() => ({ values: insertValues }));
      const tx = { select, insert } as never;

      const result = await togglePostLike(tx, userId, postId);

      expect(result).toEqual({ liked: true });
      expect(insert).toHaveBeenCalled();
    });
  });

  describe("countLikesByPostIds", () => {
    it("returns like counts grouped by postId", async () => {
      const rows = [
        { postId: "post-1", count: 5 },
        { postId: "post-2", count: 3 },
      ];
      const groupBy = vi.fn().mockResolvedValue(rows);
      const where = vi.fn(() => ({ groupBy }));
      const from = vi.fn(() => ({ where }));
      const select = vi.fn(() => ({ from }));
      const db = { select } as never;

      const result = await countLikesByPostIds(db, ["post-1", "post-2"]);

      expect(result).toEqual([
        { postId: "post-1", count: 5 },
        { postId: "post-2", count: 3 },
      ]);
    });

    it("returns empty array for empty postIds", async () => {
      const db = {} as never;

      const result = await countLikesByPostIds(db, []);

      expect(result).toEqual([]);
    });
  });

  describe("findUserLikesByPostIds", () => {
    it("returns postIds that the user has liked", async () => {
      const rows = [{ postId: "post-1" }, { postId: "post-3" }];
      const where = vi.fn().mockResolvedValue(rows);
      const from = vi.fn(() => ({ where }));
      const select = vi.fn(() => ({ from }));
      const db = { select } as never;

      const result = await findUserLikesByPostIds(db, userId, ["post-1", "post-2", "post-3"]);

      expect(result).toEqual(["post-1", "post-3"]);
    });

    it("returns empty array when user has no likes", async () => {
      const where = vi.fn().mockResolvedValue([]);
      const from = vi.fn(() => ({ where }));
      const select = vi.fn(() => ({ from }));
      const db = { select } as never;

      const result = await findUserLikesByPostIds(db, userId, ["post-1"]);

      expect(result).toEqual([]);
    });

    it("returns empty array for empty postIds", async () => {
      const db = {} as never;

      const result = await findUserLikesByPostIds(db, userId, []);

      expect(result).toEqual([]);
    });
  });
});
