import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTPException } from "hono/http-exception";
import { AuthRestError, DbError, RlsError } from "@repo/errors";
import { AuthError } from "@repo/errors/server";

/**
 * RFC 7807 Problem Details 形式のエラーレスポンス型
 */
type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
};

/**
 * formatErrorResponse の戻り値の型
 */
type ErrorMapping = {
  body: ProblemDetails;
  statusCode: ContentfulStatusCode;
  clearCookie?: boolean;
};

/**
 * ステータスコード → type URI / title のマッピングテーブル
 */
const STATUS_MAPPING: Record<number, { typeUri: string; title: string }> = {
  400: {
    typeUri: "https://api.otography.com/errors/bad-request",
    title: "Bad Request",
  },
  401: {
    typeUri: "https://api.otography.com/errors/unauthorized",
    title: "Unauthorized",
  },
  403: {
    typeUri: "https://api.otography.com/errors/forbidden",
    title: "Forbidden",
  },
  404: {
    typeUri: "https://api.otography.com/errors/not-found",
    title: "Not Found",
  },
  409: {
    typeUri: "https://api.otography.com/errors/conflict",
    title: "Conflict",
  },
  429: {
    typeUri: "https://api.otography.com/errors/too-many-requests",
    title: "Too Many Requests",
  },
  500: {
    typeUri: "https://api.otography.com/errors/internal-error",
    title: "Internal Server Error",
  },
  502: {
    typeUri: "https://api.otography.com/errors/bad-gateway",
    title: "Bad Gateway",
  },
  503: {
    typeUri: "https://api.otography.com/errors/service-unavailable",
    title: "Service Unavailable",
  },
};

/**
 * ステータスコードから ProblemDetails を生成するヘルパー
 */
const toProblemDetails = (statusCode: number, detail: string): ProblemDetails => {
  const mapping = STATUS_MAPPING[statusCode] ?? STATUS_MAPPING[500]!;
  return {
    type: mapping.typeUri,
    title: mapping.title,
    status: statusCode,
    detail,
  };
};

/**
 * 未知のエラーを RFC 7807 形式に変換する（内部情報を漏洩しない）
 */
const toInternalError = (): ProblemDetails => {
  return toProblemDetails(500, "Internal server error.");
};

/**
 * 全エラータイプを RFC 7807 Problem Details に変換する。
 *
 * - AuthError / DbError → 実際のメッセージを使用（ユーザー向け）
 * - RlsError / unknown → detail を "Internal server error." に固定（内部情報漏洩防止）
 */
export const formatErrorResponse = (error: unknown): ErrorMapping => {
  // AuthError（clearCookie 伝播あり）
  if (error instanceof AuthError) {
    const result: ErrorMapping = {
      body: toProblemDetails(error.statusCode, error.message),
      statusCode: error.statusCode as ContentfulStatusCode,
    };
    if (error.clearCookie) {
      result.clearCookie = true;
    }
    return result;
  }

  // AuthRestError（Firebase REST API エラー、ユーザー向けメッセージ）
  if (error instanceof AuthRestError) {
    return {
      body: toProblemDetails(error.statusCode, error.message),
      statusCode: error.statusCode as ContentfulStatusCode,
    };
  }

  // DbError（ユーザー向けメッセージ）
  if (error instanceof DbError) {
    return {
      body: toProblemDetails(error.statusCode, error.message),
      statusCode: error.statusCode as ContentfulStatusCode,
    };
  }

  // RlsError（内部情報隠蔽）
  if (error instanceof RlsError) {
    return {
      body: toInternalError(),
      statusCode: 500 as ContentfulStatusCode,
    };
  }

  // Hono HTTPException
  if (error instanceof HTTPException) {
    return {
      body: toProblemDetails(error.status, error.message),
      statusCode: error.status as ContentfulStatusCode,
    };
  }

  // unknown Error（内部情報隠蔽）
  return {
    body: toInternalError(),
    statusCode: 500 as ContentfulStatusCode,
  };
};
