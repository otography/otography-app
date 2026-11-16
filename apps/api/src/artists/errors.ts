import * as errore from "errore";

export class ArtistQueryError extends errore.createTaggedError({
  name: "ArtistQueryError",
  message: "アーティスト $artistId の読み書きに失敗しました",
}) {}
