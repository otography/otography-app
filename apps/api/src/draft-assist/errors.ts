import { createTaggedError } from "errore";

export class DecisionModelConfigError extends createTaggedError({
  name: "DecisionModelConfigError",
  message: "判断モデルの設定が不足しています: $detail",
}) {}

export class DecisionModelTimeoutError extends createTaggedError({
  name: "DecisionModelTimeoutError",
  message: "判断モデルの呼び出しがタイムアウトしました ($timeoutMs ms)",
}) {}

export class DecisionModelRequestError extends createTaggedError({
  name: "DecisionModelRequestError",
  message: "判断モデルの呼び出しに失敗しました",
}) {}

export class DecisionModelParseError extends createTaggedError({
  name: "DecisionModelParseError",
  message: "判断モデルの応答を解釈できませんでした: $detail",
}) {}
