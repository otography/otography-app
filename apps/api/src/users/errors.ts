import * as errore from "errore";

export class MeResponseError extends errore.createTaggedError({
  name: "MeResponseError",
  message: "ログイン中のユーザーの情報を応答の形に変換できませんでした",
}) {}

export class UserNotFoundError extends errore.createTaggedError({
  name: "UserNotFoundError",
  message: "ユーザー $publicId は見つかりません。URL を確認してください",
}) {}

export class UserQueryError extends errore.createTaggedError({
  name: "UserQueryError",
  message: "ユーザーの情報の読み書きに失敗しました",
}) {}

export class ProfileOutputError extends errore.createTaggedError({
  name: "ProfileOutputError",
  message: "ユーザー $publicId のプロフィールを応答の形に変換できませんでした",
}) {}

export class DuplicateFavoriteSongError extends errore.createTaggedError({
  name: "DuplicateFavoriteSongError",
  message: "同じ曲（ISRC $isrc）が 2 回選ばれています。重複を外してください",
}) {}
