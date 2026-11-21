import type { VectorStore } from "../../src/embeddings/vector-store.ts";

/** x の置き場所（D1）の代わりに、メモリに入れる。rows で中身を確かめる。 */
export const memoryStore = () => {
  const rows = new Map<string, Float32Array>();
  const store: VectorStore = {
    put: async (items) => {
      for (const item of items) {
        if (!rows.has(item.postId)) {
          rows.set(item.postId, item.x);
        }
      }
      return null;
    },
    get: async (ids) =>
      new Map(
        ids.flatMap((id) => {
          const vector = rows.get(id);
          return vector ? [[id, vector] as const] : [];
        }),
      ),
  };
  return { rows, store };
};
