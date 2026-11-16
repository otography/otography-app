/** お気に入りに付けられる色。DB には名前で保存し、実際の色は表示側で決める。 */
export const FAVORITE_COLORS = [
  "red",
  "orange",
  "amber",
  "lime",
  "green",
  "teal",
  "sky",
  "blue",
  "violet",
  "pink",
  "brown",
  "gray",
] as const;
export type FavoriteColor = (typeof FAVORITE_COLORS)[number];

/** 曲・アーティストそれぞれのお気に入り上限。 */
export const FAVORITE_LIMIT = 10;
export const FAVORITE_COMMENT_MAX = 100;
export const USER_NAME_MAX = 50;
export const USER_BIO_MAX = 300;

/** 投稿の本文の上限（文字数。Unicode のコードポイントで数える）。 */
export const POST_CONTENT_MAX = 140;
/** ISRC の長さ。 */
export const ISRC_LENGTH = 12;

export const EMBEDDING_DIMENSIONS = 2048;
/** モデル名 + 埋め込む文の組み立て方の版。本文だけを埋め込む。 */
export const EMBEDDING_MODEL = "plamo-1b:v1";

export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
