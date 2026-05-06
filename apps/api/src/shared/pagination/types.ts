import type { cursorSchema } from "./schema";

export type Cursor = typeof cursorSchema.infer;

/** レスポンスに含めるページネーションメタデータ */
export type PaginationMeta = {
  hasNext: boolean;
  nextCursor: Cursor | null;
};
