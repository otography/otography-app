import * as errore from "errore";

export class SongQueryError extends errore.createTaggedError({
  name: "SongQueryError",
  message: "曲 $isrc の読み書きに失敗しました",
}) {}

export class SongConflictError extends errore.createTaggedError({
  name: "SongConflictError",
  message:
    "曲 $isrc（Apple の ID $appleSongId）を保存できませんでした。同じ Apple の ID が別の ISRC で保存されています",
}) {}
