import * as errore from "errore";

export class EmbeddingMetricError extends errore.createTaggedError({
  name: "EmbeddingMetricError",
  message: "埋め込みの統計を読み書きできませんでした",
}) {}

export class EmbeddingSearchError extends errore.createTaggedError({
  name: "EmbeddingSearchError",
  message: "埋め込みで投稿を検索できませんでした",
}) {}
