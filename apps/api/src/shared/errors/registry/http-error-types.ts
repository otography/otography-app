import type { ErrorStatusCode, StatusProblemSlug } from "@repo/errors";

export type StatusTypeDefinition = {
  slug: StatusProblemSlug;
  typeUri: string;
  title: string;
  description: string;
  statusCode: ErrorStatusCode;
};

/**
 * 汎用 Problem Details 型のレジストリ。
 * domain 固有の説明文を持たない、HTTP ステータスに紐づく標準的なエラー型を扱う。
 */
export const STATUS_ERROR_TYPES = [
  {
    slug: "bad-request",
    typeUri: "https://api.otography.com/errors/bad-request",
    title: "Bad Request",
    description: "リクエストの形式または内容が不正です。入力内容を確認してください。",
    statusCode: 400 as ErrorStatusCode,
  },
  {
    slug: "unauthorized",
    typeUri: "https://api.otography.com/errors/unauthorized",
    title: "Unauthorized",
    description: "認証が必要です。ログインしてから再試行してください。",
    statusCode: 401 as ErrorStatusCode,
  },
  {
    slug: "forbidden",
    typeUri: "https://api.otography.com/errors/forbidden",
    title: "Forbidden",
    description: "この操作を実行する権限がありません。",
    statusCode: 403 as ErrorStatusCode,
  },
  {
    slug: "not-found",
    typeUri: "https://api.otography.com/errors/not-found",
    title: "Not Found",
    description: "指定されたリソースが見つかりません。",
    statusCode: 404 as ErrorStatusCode,
  },
  {
    slug: "conflict",
    typeUri: "https://api.otography.com/errors/conflict",
    title: "Conflict",
    description: "現在のリソース状態と競合するため、リクエストを完了できません。",
    statusCode: 409 as ErrorStatusCode,
  },
  {
    slug: "too-many-requests",
    typeUri: "https://api.otography.com/errors/too-many-requests",
    title: "Too Many Requests",
    description: "リクエスト数が制限を超えました。しばらく待ってから再試行してください。",
    statusCode: 429 as ErrorStatusCode,
  },
  {
    slug: "internal-error",
    typeUri: "https://api.otography.com/errors/internal-error",
    title: "Internal Server Error",
    description: "サーバー内部でエラーが発生しました。しばらく待ってから再試行してください。",
    statusCode: 500 as ErrorStatusCode,
  },
  {
    slug: "bad-gateway",
    typeUri: "https://api.otography.com/errors/bad-gateway",
    title: "Bad Gateway",
    description: "外部サービスとの通信に失敗しました。しばらく待ってから再試行してください。",
    statusCode: 502 as ErrorStatusCode,
  },
  {
    slug: "service-unavailable",
    typeUri: "https://api.otography.com/errors/service-unavailable",
    title: "Service Unavailable",
    description: "サービスが一時的に利用できません。しばらく待ってから再試行してください。",
    statusCode: 503 as ErrorStatusCode,
  },
] as const satisfies readonly StatusTypeDefinition[];
