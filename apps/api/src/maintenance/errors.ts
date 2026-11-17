import * as errore from "errore";

export class PurgeError extends errore.createTaggedError({
  name: "PurgeError",
  message: "期限を過ぎた $target の物理削除に失敗しました",
}) {}
