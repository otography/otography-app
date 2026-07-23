import { type } from "arktype";
import type { Cursor } from "../../shared/pagination";

/** Apple Music ID パスパラメータスキーマ */
export const appleMusicIdParamSchema = type({
  appleMusicId: "string >= 1",
});

/** ユーザー ID パスパラメータスキーマ */
export const userIdParamSchema = type({
  userId: "string.uuid",
});

/** お気に入り一覧で共通のページネーションクエリ契約 */
export const parsePaginationQuery = (c: {
  req: { query: (key: string) => string | undefined };
}) => {
  const limitParam = c.req.query("limit");
  const cursorCreatedAt = c.req.query("cursor[createdAt]");
  const cursorId = c.req.query("cursor[id]");
  const cursor: Cursor | undefined =
    cursorCreatedAt && cursorId ? { createdAt: cursorCreatedAt, id: cursorId } : undefined;

  return {
    limit: limitParam ? parseInt(limitParam, 10) : undefined,
    cursor,
  };
};
