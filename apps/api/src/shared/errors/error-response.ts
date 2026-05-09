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
  type ProblemSlug,
} from "@repo/errors";
import { AuthError } from "@repo/errors/server";
import { getProblemType, STATUS_ERROR_TYPES } from "./error-registry";

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

type FormatErrorOptions = {
  instance?: string;
};

/**
 * ステータスコード → type URI / title のマッピングテーブル
 */
const STATUS_MAPPING: Record<
  number,
  { typeUri: string; title: string; statusCode: ErrorStatusCode }
> = Object.fromEntries(
  STATUS_ERROR_TYPES.map(({ statusCode, typeUri, title }) => [
    statusCode,
    { typeUri, title, statusCode },
  ]),
);

export const createProblemInstance = (): string => {
  return `urn:otography:problem:${crypto.randomUUID()}`;
};

/**
 * ステータスコードと problem slug から ProblemDetails を生成するヘルパー。
 * problemSlug がある場合は registry を唯一の source of truth として扱う。
 */
const toProblemDetails = (
  statusCode: number,
  detail: string,
  problemSlug?: ProblemSlug,
  instance?: string,
): ProblemDetails => {
  const definition = problemSlug ? getProblemType(problemSlug) : undefined;
  const mapping = definition ?? STATUS_MAPPING[statusCode] ?? STATUS_MAPPING[500]!;
  return {
    type: mapping.typeUri,
    title: mapping.title,
    status: mapping.statusCode ?? statusCode,
    detail,
    ...(instance ? { instance } : {}),
  };
};

/**
 * 未知のエラーを RFC 9457 形式に変換する（内部情報を漏洩しない）
 */
const toInternalError = (instance?: string): ProblemDetails => {
  return toProblemDetails(500, "Internal server error.", undefined, instance);
};

/**
 * 全エラータイプを RFC 9457 Problem Details に変換する。
 *
 * - AuthError / DbError / OAuth 系エラー → registry 登録済み problemSlug があれば使用
 * - RlsError / unknown → detail を "Internal server error." に固定（内部情報漏洩防止）
 */
export const formatErrorResponse = (
  error: unknown,
  options: FormatErrorOptions = {},
): ErrorMapping => {
  const mapProblemSlug = (
    statusCode: ErrorStatusCode,
    message: string,
    problemSlug?: ProblemSlug,
  ) => {
    const resolvedStatusCode = problemSlug ? getProblemType(problemSlug).statusCode : statusCode;
    return {
      body: toProblemDetails(statusCode, message, problemSlug, options.instance),
      statusCode: resolvedStatusCode,
    };
  };

  // AuthError（clearCookie 伝播あり）
  if (error instanceof AuthError) {
    const result: ErrorMapping = {
      ...mapProblemSlug(error.statusCode, error.message, error.problemSlug),
    };
    if (error.clearCookie) {
      result.clearCookie = true;
    }
    return result;
  }

  // AuthRestError（Firebase REST API エラー、ユーザー向けメッセージ）
  if (error instanceof AuthRestError) {
    return mapProblemSlug(error.statusCode, error.message, error.problemSlug);
  }

  // DbError（ユーザー向けメッセージ）
  if (error instanceof DbError) {
    return mapProblemSlug(error.statusCode, error.message, error.problemSlug);
  }

  // OAuth 系エラー（ユーザー向けメッセージ + problemSlug 対応）
  if (
    error instanceof OAuthExchangeError ||
    error instanceof GoogleTokenExchangeError ||
    error instanceof FirebaseIdpSigninError ||
    error instanceof AccountConflictError
  ) {
    return mapProblemSlug(error.statusCode as ErrorStatusCode, error.message, error.problemSlug);
  }

  // RlsError（内部情報隠蔽、problemSlug も無視）
  if (error instanceof RlsError) {
    return {
      body: toInternalError(options.instance),
      statusCode: 500,
    };
  }

  // Hono HTTPException
  if (error instanceof HTTPException) {
    return {
      body: toProblemDetails(error.status, error.message, undefined, options.instance),
      statusCode: error.status as ErrorStatusCode,
    };
  }

  // unknown Error（内部情報隠蔽）
  return {
    body: toInternalError(options.instance),
    statusCode: 500,
  };
};

const problemBody = (slug: ProblemSlug, detail: string, instance: string): ProblemDetails => {
  const definition = getProblemType(slug);
  return {
    type: definition.typeUri,
    title: definition.title,
    status: definition.statusCode,
    detail,
    instance,
  };
};

/**
 * registry の slug から Problem Details レスポンスを返す。
 * route 側では title/status/type URI を手書きせず、detail だけを渡す。
 */
export const problemResponse = (c: Context, slug: ProblemSlug, detail: string) => {
  const body = problemBody(slug, detail, createProblemInstance());
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
  const { body, statusCode } = formatErrorResponse(error, {
    instance: createProblemInstance(),
  });
  return c.body(JSON.stringify(body), statusCode, {
    "Content-Type": "application/problem+json",
  });
};
