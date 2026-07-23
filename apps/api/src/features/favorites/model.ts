import { type } from "arktype";
export { parsePaginationQuery } from "../../shared/pagination";

/** Apple Music ID パスパラメータスキーマ */
export const appleMusicIdParamSchema = type({
  appleMusicId: "string >= 1",
});

/** ユーザー ID パスパラメータスキーマ */
export const userIdParamSchema = type({
  userId: "string.uuid",
});
