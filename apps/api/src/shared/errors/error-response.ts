import type { Context } from "hono";
import type { ErrorStatusCode, ProblemSlug } from "@repo/errors";
import { createProblemInstance, formatErrorResponse, problemBody } from "./error-format";

export * from "./error-format";

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
  const { body, statusCode, headers } = formatErrorResponse(error, {
    instance: createProblemInstance(),
  });
  return c.body(JSON.stringify(body), statusCode, {
    "Content-Type": "application/problem+json",
    ...headers,
  });
};
