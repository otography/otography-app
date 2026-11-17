import * as errore from "errore";

export class ReportTargetNotFoundError extends errore.createTaggedError({
  name: "ReportTargetNotFoundError",
  message: "通報する投稿かユーザーが見つかりません。削除されたか、URL が間違っています",
}) {}

export class SelfReportError extends errore.createTaggedError({
  name: "SelfReportError",
  message: "自分の投稿や自分自身は通報できません",
}) {}

export class ReportQueryError extends errore.createTaggedError({
  name: "ReportQueryError",
  message: "通報の読み書きに失敗しました",
}) {}
