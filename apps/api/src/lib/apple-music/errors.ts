import * as errore from "errore";

export class DeveloperTokenError extends errore.createTaggedError({
  name: "DeveloperTokenError",
  message:
    "Apple Music の開発者トークンを作れませんでした。APPLE_TEAM_ID、APPLE_KEY_ID、APPLE_MUSIC_PRIVATE_KEY の値を確認してください",
}) {}

export class AppleMusicRequestError extends errore.createTaggedError({
  name: "AppleMusicRequestError",
  message: "Apple Music API へのリクエストが失敗しました（$path）",
}) {}

export class AppleMusicRateLimitError extends errore.createTaggedError({
  name: "AppleMusicRateLimitError",
  message:
    "Apple Music API のリクエスト数の上限を超えました。しばらく待ってから、もう一度試してください",
}) {}

export class AppleSongNotFoundError extends errore.createTaggedError({
  name: "AppleSongNotFoundError",
  message: "Apple Music に曲 $songId が見つかりません。曲を検索し直してください",
}) {}

export class SongWithoutIsrcError extends errore.createTaggedError({
  name: "SongWithoutIsrcError",
  message: "曲 $songId には ISRC がないので選べません。別の曲を選んでください",
}) {}

export type FetchCatalogSongError =
  | AppleMusicRequestError
  | AppleMusicRateLimitError
  | AppleSongNotFoundError
  | SongWithoutIsrcError;
