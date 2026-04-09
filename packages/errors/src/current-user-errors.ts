import * as errore from "errore";

// セッションが無効・期限切れ（API が 401 を返した）
export class UnauthenticatedError extends errore.createTaggedError({
  name: "UnauthenticatedError",
  message: "User is not authenticated",
}) {}

// Firebase Auth のセッションは有効だが DB レコードが存在しない（API が 404 を返した）
export class NoProfileError extends errore.createTaggedError({
  name: "NoProfileError",
  message: "User profile not found",
}) {}

// getCurrentUser の fetch 自体が失敗
export class FetchCurrentUserError extends errore.createTaggedError({
  name: "FetchCurrentUserError",
  message: "Failed to fetch the current user",
}) {}

// API が予期しないステータスコードを返した
export class UnexpectedStatusError extends errore.createTaggedError({
  name: "UnexpectedStatusError",
  message: "Unexpected response status $status",
}) {}

// レスポンスボディの JSON パースに失敗
export class JsonParseError extends errore.createTaggedError({
  name: "JsonParseError",
  message: "Failed to parse response as JSON",
}) {}

// レスポンスボディがスキーマにマッチしない
export class SchemaValidationError extends errore.createTaggedError({
  name: "SchemaValidationError",
  message: "Response does not match expected schema: $summary",
}) {}
