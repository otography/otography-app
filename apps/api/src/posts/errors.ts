import * as errore from "errore";

export class PostInsertError extends errore.createTaggedError({
  name: "PostInsertError",
  message: "投稿を保存できませんでした",
}) {}

export class MissingIpAddressError extends errore.createTaggedError({
  name: "MissingIpAddressError",
  message: "リクエストに CF-Connecting-IP がないので、投稿を保存できません",
}) {}

export class PostNotFoundError extends errore.createTaggedError({
  name: "PostNotFoundError",
  message: "投稿 $postId は見つかりません。削除されたか、URL が間違っています",
}) {}

export class PostQueryError extends errore.createTaggedError({
  name: "PostQueryError",
  message: "投稿の読み書きに失敗しました",
}) {}

export class PostOutputError extends errore.createTaggedError({
  name: "PostOutputError",
  message: "投稿 $postId を応答の形に変換できませんでした",
}) {}
