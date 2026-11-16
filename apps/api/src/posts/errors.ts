import * as errore from "errore";

export class PostInsertError extends errore.createTaggedError({
  name: "PostInsertError",
  message: "投稿を保存できませんでした",
}) {}

export class MissingIpAddressError extends errore.createTaggedError({
  name: "MissingIpAddressError",
  message: "リクエストに CF-Connecting-IP がないので、投稿を保存できません",
}) {}

export class PostOutputError extends errore.createTaggedError({
  name: "PostOutputError",
  message: "投稿 $postId を応答の形に変換できませんでした",
}) {}
