import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  AuthRestError,
  DbError,
  RlsError,
  OAuthExchangeError,
  GoogleTokenExchangeError,
  FirebaseIdpSigninError,
  AccountConflictError,
  type ErrorStatusCode,
} from "@repo/errors";
import { AuthError } from "@repo/errors/server";
import { findProblemTypeByUri, getProblemType, STATUS_ERROR_TYPES } from "./error-registry";
import type { ProblemSlug } from "./error-registry";

/**
 * RFC 9457 Problem Details 形式のエラーレスポンス型
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
  statusCode: ErrorStatusCode;
  clearCookie?: boolean;
};

/**
 * ステータスコード → type URI / title のマッピングテーブル
 */
const STATUS_MAPPING: Record<number, { typeUri: string; title: string }> = Object.fromEntries(
  STATUS_ERROR_TYPES.map(({ statusCode, typeUri, title }) => [statusCode, { typeUri, title }]),
);

/**
 * ステータスコードと typeUri から ProblemDetails を生成するヘルパー。
 * typeUri が registry にある場合は、RFC 9457 の problem type summary としてその title を使う。
 */
const toProblemDetails = (statusCode: number, detail: string, typeUri?: string): ProblemDetails => {
  const definition = typeUri ? findProblemTypeByUri(typeUri) : undefined;
  const mapping = definition ?? STATUS_MAPPING[statusCode] ?? STATUS_MAPPING[500]!;
  return {
    type: definition?.typeUri ?? mapping.typeUri,
    title: mapping.title,
    status: statusCode,
    detail,
  };
};

/**
 * 未知のエラーを RFC 9457 形式に変換する（内部情報を漏洩しない）
 */
const toInternalError = (): ProblemDetails => {
  return toProblemDetails(500, "Internal server error.");
};

/**
 * 全エラータイプを RFC 9457 Problem Details に変換する。
 *
 * - AuthError / DbError / OAuth 系エラー → registry 登録済み typeUri があれば使用
 * - RlsError / unknown → detail を "Internal server error." に固定（内部情報漏洩防止）
 */
export const formatErrorResponse = (error: unknown): ErrorMapping => {
  // AuthError（clearCookie 伝播あり）
  if (error instanceof AuthError) {
    const result: ErrorMapping = {
      body: toProblemDetails(error.statusCode, error.message, error.typeUri),
      statusCode: error.statusCode,
    };
    if (error.clearCookie) {
      result.clearCookie = true;
    }
    return result;
  }

  // AuthRestError（Firebase REST API エラー、ユーザー向けメッセージ）
  if (error instanceof AuthRestError) {
    return {
      body: toProblemDetails(error.statusCode, error.message, error.typeUri),
      statusCode: error.statusCode,
    };
  }

  // DbError（ユーザー向けメッセージ）
  if (error instanceof DbError) {
    return {
      body: toProblemDetails(error.statusCode, error.message, error.typeUri),
      statusCode: error.statusCode,
    };
  }

  // OAuth 系エラー（ユーザー向けメッセージ + typeUri 対応）
  if (
    error instanceof OAuthExchangeError ||
    error instanceof GoogleTokenExchangeError ||
    error instanceof FirebaseIdpSigninError ||
    error instanceof AccountConflictError
  ) {
    return {
      body: toProblemDetails(error.statusCode, error.message, error.typeUri),
      statusCode: error.statusCode as ErrorStatusCode,
    };
  }

  // RlsError（内部情報隠蔽、typeUri も無視）
  if (error instanceof RlsError) {
    return {
      body: toInternalError(),
      statusCode: 500,
    };
  }

  // Hono HTTPException
  if (error instanceof HTTPException) {
    return {
      body: toProblemDetails(error.status, error.message),
      statusCode: error.status as ErrorStatusCode,
    };
  }

  // unknown Error（内部情報隠蔽）
  return {
    body: toInternalError(),
    statusCode: 500,
  };
};

const problemBody = (slug: ProblemSlug, detail: string): ProblemDetails => {
  const definition = getProblemType(slug);
  return {
    type: definition.typeUri,
    title: definition.title,
    status: definition.statusCode,
    detail,
  };
};

/**
 * registry の slug から Problem Details レスポンスを返す。
 * route 側では title/status/type URI を手書きせず、detail だけを渡す。
 */
export const problemResponse = (c: Context, slug: ProblemSlug, detail: string) => {
  const body = problemBody(slug, detail);
  return c.body(JSON.stringify(body), body.status as ErrorStatusCode, {
    "Content-Type": "application/problem+json",
  });
};

export const badRequestResponse = (c: Context, detail: string) => {
  return problemResponse(c, "bad-request", detail);
};

export const unauthorizedResponse = (c: Context, detail: string) => {
  return problemResponse(c, "unauthorized", detail);
};

/**
 * エラーオブジェクトを RFC 9457 Problem Details レスポンスに変換して返す。
 * ルートハンドラ内の `if (result instanceof Error)` パターンを簡潔にする。
 */
export const respondWithError = (error: Error, c: Context): Response => {
  const { body, statusCode } = formatErrorResponse(error);
  return c.body(JSON.stringify(body), statusCode, {
    "Content-Type": "application/problem+json",
  });
};
