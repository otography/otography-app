import { describe, expect, it, vi } from "vitest";
import { togglePostLike } from "../../../features/post-likes/repository";

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
});
