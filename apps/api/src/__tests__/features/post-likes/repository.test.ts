import { describe, expect, it, vi } from "vitest";
import {
  togglePostLike,
  countLikesByPostIds,
  findUserLikesByPostIds,
} from "../../../features/post-likes/repository";

const postId = "6f648f36-5be1-4af1-bf5d-cf8ebf222221";
const userId = "7f648f36-5be1-4af1-bf5d-cf8ebf222220";

const getSqlText = (query: unknown) => {
  const chunks = (query as { queryChunks: { value?: string[] }[] }).queryChunks;
  return chunks.flatMap((chunk) => chunk.value ?? []).join(" ");
};

describe("post-likes repository", () => {
  describe("togglePostLike", () => {
    it("returns liked=false when existing like is deleted", async () => {
      // CTE: DELETEが1行返す → INSERTのWHERE NOT EXISTSがfalse → INSERTなし
      const execute = vi.fn().mockResolvedValue([]);
      const tx = { execute } as never;

      const result = await togglePostLike(tx, userId, postId);

      expect(result).toEqual({ liked: false });
      expect(execute).toHaveBeenCalled();
    });

    it("returns liked=true when no existing like and insert succeeds", async () => {
      // CTE: DELETEが0行 → INSERT実行 → 1行返す
      const execute = vi.fn().mockResolvedValue([{ user_id: userId }]);
      const tx = { execute } as never;

      const result = await togglePostLike(tx, userId, postId);

      expect(result).toEqual({ liked: true });
      expect(execute).toHaveBeenCalled();
    });

    it("serializes toggles for the same user and post", async () => {
      const execute = vi.fn().mockResolvedValue([{ liked: true }]);
      const tx = { execute } as never;

      await togglePostLike(tx, userId, postId);

      const query = execute.mock.calls[0]?.[0];
      expect(getSqlText(query)).toContain("pg_advisory_xact_lock");
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
