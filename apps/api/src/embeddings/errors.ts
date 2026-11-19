import * as errore from "errore";

export class EmbeddingMetricError extends errore.createTaggedError({
  name: "EmbeddingMetricError",
  message: "埋め込みの統計を読み書きできませんでした",
}) {}

export class EmbeddingTransformError extends errore.createTaggedError({
  name: "EmbeddingTransformError",
  message: "埋め込みの変換 $model を読めませんでした",
}) {}

export class EmbeddingRequestError extends errore.createTaggedError({
  name: "EmbeddingRequestError",
  message: "Workers AI で埋め込みを作れませんでした",
}) {}

export class VectorStoreError extends errore.createTaggedError({
  name: "VectorStoreError",
  message: "元のベクトル（D1）を読み書きできませんでした",
}) {}

export class EmbeddingSaveError extends errore.createTaggedError({
  name: "EmbeddingSaveError",
  message: "投稿 $postId の埋め込みを保存できませんでした",
}) {}

export class EmbeddingSearchError extends errore.createTaggedError({
  name: "EmbeddingSearchError",
  message: "埋め込みで投稿を検索できませんでした",
}) {}
