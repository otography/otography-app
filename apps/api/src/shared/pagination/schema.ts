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
