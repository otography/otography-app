import * as errore from "errore";

export class MeResponseError extends errore.createTaggedError({
  name: "MeResponseError",
  message: "ログイン中のユーザーの情報を応答の形に変換できませんでした",
}) {}
