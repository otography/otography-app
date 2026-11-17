import * as errore from "errore";

export class AdminQueryError extends errore.createTaggedError({
  name: "AdminQueryError",
  message: "管理の操作で DB の読み書きに失敗しました",
}) {}

export class ReportNotFoundError extends errore.createTaggedError({
  name: "ReportNotFoundError",
  message: "通報 $reportId は見つかりません",
}) {}

export class AdminTargetNotFoundError extends errore.createTaggedError({
  name: "AdminTargetNotFoundError",
  message: "対象の $kind（$id）は見つかりません",
}) {}

export class SelfSuspendError extends errore.createTaggedError({
  name: "SelfSuspendError",
  message: "自分自身は停止できません",
}) {}

export class ReportsOutputError extends errore.createTaggedError({
  name: "ReportsOutputError",
  message: "通報の一覧を応答の形に変換できませんでした",
}) {}
