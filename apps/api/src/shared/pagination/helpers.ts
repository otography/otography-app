import type { PaginationMeta } from "./types";
import { DEFAULT_LIMIT, MAX_LIMIT } from "./schema";

/** limit を正規化（未指定時はデフォルト、上限クリップ） */
export const normalizeLimit = (limit?: number): number => {
  if (limit === undefined || limit === null) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, limit), MAX_LIMIT);
};

/** items から次ページのカーソルを算出 */
export const buildPaginationMeta = <T extends { createdAt: string; id: string }>(
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
  return {
    hasNext: true,
    nextCursor: {
      createdAt: lastItem.createdAt,
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

type CursorSource = { createdAt: string; id: string };

export function createPage<T extends CursorSource, U>(
  rows: T[],
  requestedLimit: number,
  mapItem: (row: T) => U,
): { items: U[]; pagination: PaginationMeta };
export function createPage<T, U>(
  rows: T[],
  requestedLimit: number,
  mapItem: (row: T) => U,
  getCursorSource: (row: T) => CursorSource,
): { items: U[]; pagination: PaginationMeta };
/** LIMIT + 1 の行から、公開項目とページネーションメタデータを同時に生成 */
export function createPage<T, U>(
  rows: T[],
  requestedLimit: number,
  mapItem: (row: T) => U,
  getCursorSource?: (row: T) => CursorSource,
) {
  const cursorRows = getCursorSource ? rows.map(getCursorSource) : (rows as (T & CursorSource)[]);

  return {
    items: trimItems(rows, requestedLimit).map(mapItem),
    pagination: buildPaginationMeta(cursorRows, requestedLimit),
  };
}
