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

/**
 * 検索に使うベクトル z の次元数。モデルが出す 2048 次元の x を、変換 z = Ax + b で落とした後の次元数。
 * 設計ドキュメント「埋め込みの保存と中心化・白色化の設計」を参照。
 */
export const EMBEDDING_DIMENSIONS = 256;
/** モデル（Workers AI の PLaMo-Embedding-1B）が出すベクトル x の次元数。 */
export const EMBEDDING_INPUT_DIMENSIONS = 2048;
/**
 * post_embeddings.model に入れる値。埋め込みのモデルと、x を z に落とす変換の版を表す。
 * embedding_transforms の行の model と同じ値にする（docs/adr/0020-embedding-pca-without-whitening.md）。
 */
export const EMBEDDING_MODEL = "plamo-1b:pca256-v1";

export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
/** 通報の理由。表示する文言は画面側で決める。 */
export const REPORT_REASONS = [
  "spam",
  "harassment",
  "inappropriate",
  "impersonation",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
/** 通報の詳細の上限（文字数）。 */
export const REPORT_DETAIL_MAX = 500;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
