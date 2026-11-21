import { createTaggedError } from "errore";

export class DeveloperTokenError extends createTaggedError({
  name: "DeveloperTokenError",
  message:
    "Apple Music の開発者トークンを作れませんでした。APPLE_TEAM_ID、APPLE_KEY_ID、APPLE_MUSIC_PRIVATE_KEY の値を確認してください",
}) {}

export class AppleMusicRequestError extends createTaggedError({
  name: "AppleMusicRequestError",
  message: "Apple Music API へのリクエストが失敗しました（$path）",
}) {}

export class AppleMusicRateLimitError extends createTaggedError({
  name: "AppleMusicRateLimitError",
  message:
    "Apple Music API のリクエスト数の上限を超えました。しばらく待ってから、もう一度試してください",
}) {}

export class AppleSongNotFoundError extends createTaggedError({
  name: "AppleSongNotFoundError",
  message: "Apple Music に曲 $songId が見つかりません。曲を検索し直してください",
}) {}

export class SongWithoutIsrcError extends createTaggedError({
  name: "SongWithoutIsrcError",
  message: "曲 $songId には ISRC がないので選べません。別の曲を選んでください",
}) {}

export class AppleArtistNotFoundError extends createTaggedError({
  name: "AppleArtistNotFoundError",
  message:
    "Apple Music にアーティスト $artistId が見つかりません。アーティストを検索し直してください",
}) {}

export type FetchCatalogArtistError =
  | AppleMusicRequestError
  | AppleMusicRateLimitError
  | AppleArtistNotFoundError;

export type FetchCatalogSongError =
  | AppleMusicRequestError
  | AppleMusicRateLimitError
  | AppleSongNotFoundError
  | SongWithoutIsrcError;
