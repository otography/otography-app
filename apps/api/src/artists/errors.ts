import { createTaggedError } from "errore";

export class ArtistQueryError extends createTaggedError({
  name: "ArtistQueryError",
  message: "アーティスト $artistId の読み書きに失敗しました",
}) {}
