import { createTaggedError } from "errore";

export class EmbeddingMetricError extends createTaggedError({
  name: "EmbeddingMetricError",
  message: "埋め込みの統計を読み書きできませんでした",
}) {}

export class EmbeddingTransformError extends createTaggedError({
  name: "EmbeddingTransformError",
  message: "埋め込みの変換 $model を読めませんでした",
}) {}

export class EmbeddingRequestError extends createTaggedError({
  name: "EmbeddingRequestError",
  message: "Workers AI で埋め込みを作れませんでした",
}) {}

export class VectorStoreError extends createTaggedError({
  name: "VectorStoreError",
  message: "元のベクトル（D1）を読み書きできませんでした",
}) {}

export class EmbeddingSaveError extends createTaggedError({
  name: "EmbeddingSaveError",
  message: "投稿 $postId の埋め込みを保存できませんでした",
}) {}

export class EmbeddingUnavailableError extends createTaggedError({
  name: "EmbeddingUnavailableError",
  message: "埋め込みの変換 $model がまだ無いので、感想を探せません",
}) {}

export class EmbeddingSearchError extends createTaggedError({
  name: "EmbeddingSearchError",
  message: "埋め込みで投稿を検索できませんでした",
}) {}
