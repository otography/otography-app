import { type } from "arktype";

/** Apple Music ID パスパラメータスキーマ */
export const appleMusicIdParamSchema = type({
  appleMusicId: "string >= 1",
});

/** ユーザー ID パスパラメータスキーマ */
export const userIdParamSchema = type({
  userId: "string.uuid",
});
