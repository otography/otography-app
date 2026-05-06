import { type } from "arktype";

/** カーソル位置を示す（createdAt + id の複合キー） */
export const cursorSchema = type({
  createdAt: "string.date.iso",
  id: "string.uuid",
});

export type Cursor = typeof cursorSchema.infer;

/** 内部用カーソル（Date オブジェクトも許可） */
export type InternalCursor = {
  createdAt: Date | string;
  id: string;
};

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** リクエストから受け取るページネーションパラメータ */
const limitSchema = type(`0<number.integer<=${MAX_LIMIT}`);

export const paginationInputSchema = type({
  "limit?": limitSchema,
  "cursor?": cursorSchema,
});

/** レスポンスに含めるページネーションメタデータ */
export type PaginationMeta = {
  hasNext: boolean;
  nextCursor: Cursor | null;
};

/** limit を正規化（未指定時はデフォルト、上限クリップ） */
export const normalizeLimit = (limit?: number): number => {
  if (limit === undefined || limit === null) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, limit), MAX_LIMIT);
};

/** items から次ページのカーソルを算出 */
export const buildPaginationMeta = <T extends { createdAt: Date | string; id: string }>(
  items: T[],
  requestedLimit: number,
): PaginationMeta => {
  // LIMIT + 1 件取得 → 余分があれば hasNext
  const hasNext = items.length > requestedLimit;

  if (!hasNext || items.length < 2) {
    return { hasNext: false, nextCursor: null };
  }

  // 最後の1件は余分なので除外し、その前のレコードがカーソル
  const lastItem = items[items.length - 2]!;
  const createdAt =
    lastItem.createdAt instanceof Date
      ? lastItem.createdAt.toISOString()
      : String(lastItem.createdAt);
  return {
    hasNext: true,
    nextCursor: {
      createdAt,
      id: lastItem.id,
    },
  };
};

/** hasNext=true の場合、余分な1件を切り捨て */
export const trimItems = <T>(items: T[], requestedLimit: number): T[] => {
  if (items.length > requestedLimit) {
    return items.slice(0, requestedLimit);
  }
  return items;
};
