import { type } from "arktype";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** カーソル位置を示す（createdAt + id の複合キー） */
export const cursorSchema = type({
  createdAt: "string.date.iso",
  id: "string.uuid",
});

/** リクエストから受け取るページネーションパラメータ */
const limitSchema = type(`0<number.integer<=${MAX_LIMIT}`);

export const paginationInputSchema = type({
  "limit?": limitSchema,
  "cursor?": cursorSchema,
});

/** HTTPクエリ文字列をページネーション入力へ変換し、境界で検証する。 */
export const parsePaginationQuery = (c: {
  req: { query: (key: string) => string | undefined };
}) => {
  const limitParam = c.req.query("limit");
  const cursorCreatedAt = c.req.query("cursor[createdAt]");
  const cursorId = c.req.query("cursor[id]");
  const limit = limitParam !== undefined && /^\d+$/.test(limitParam) ? Number(limitParam) : NaN;
  const hasCursorParam = cursorCreatedAt !== undefined || cursorId !== undefined;

  return paginationInputSchema({
    ...(limitParam !== undefined ? { limit } : {}),
    ...(hasCursorParam ? { cursor: { createdAt: cursorCreatedAt, id: cursorId } } : {}),
  });
};
