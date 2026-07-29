import { type } from "arktype";
import type { Cursor } from "./types";

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

/** クエリ文字列 → limit 数値へのモーフ（範囲外は拒否） */
const limitQuerySchema = type("string.integer.parse").to(`0 < number.integer <= ${MAX_LIMIT}`);

/** GET リストエンドポイント共通のページネーションクエリスキーマ */
export const paginationQuerySchema = type({
  "limit?": limitQuerySchema,
  "cursor[createdAt]?": "string.date",
  "cursor[id]?": "string.uuid",
})
  .narrow((q, ctx) => {
    // cursor は両方指定 or 両方未指定のみ許可
    if ((q["cursor[createdAt]"] === undefined) === (q["cursor[id]"] === undefined)) return true;
    return ctx.mustBe("a complete cursor (both cursor[createdAt] and cursor[id])");
  })
  .pipe((q): { limit?: number; cursor?: Cursor } => ({
    limit: q.limit,
    cursor:
      q["cursor[createdAt]"] !== undefined && q["cursor[id]"] !== undefined
        ? { createdAt: q["cursor[createdAt]"], id: q["cursor[id]"] }
        : undefined,
  }));
