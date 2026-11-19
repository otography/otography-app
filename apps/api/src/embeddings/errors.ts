import * as errore from "errore";

export class EmbeddingSearchError extends errore.createTaggedError({
  name: "EmbeddingSearchError",
  message: "埋め込みで投稿を検索できませんでした",
}) {}
