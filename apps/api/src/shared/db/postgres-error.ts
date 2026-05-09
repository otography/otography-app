import { DrizzleQueryError } from "drizzle-orm/errors";
import { DbError } from "@repo/errors";
import type { ErrorStatusCode } from "@repo/errors";
import postgres from "postgres";
import {
  findPostgresConstraint,
  getProblemTypeUri,
  type PostgresConstraintName,
} from "../errors/error-registry";

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const NOT_NULL_VIOLATION = "23502";

type ToDbErrorOptions = {
  constraints?: readonly PostgresConstraintName[];
};

/** PostgresError のコードからマッピングする HTTP ステータスコード */
const CODE_TO_STATUS: Record<string, ErrorStatusCode> = {
  [UNIQUE_VIOLATION]: 409 as ErrorStatusCode,
  [FOREIGN_KEY_VIOLATION]: 400 as ErrorStatusCode,
  [NOT_NULL_VIOLATION]: 400 as ErrorStatusCode,
  [CHECK_VIOLATION]: 400 as ErrorStatusCode,
};

const findPostgresError = (error: unknown): postgres.PostgresError | null => {
  if (error instanceof postgres.PostgresError) return error;

  if (error instanceof DrizzleQueryError) {
    return findPostgresError(error.cause);
  }

  if (error instanceof Error) {
    return findPostgresError(error.cause);
  }

  return null;
};

const isPostgresConstraintViolation = (
  error: unknown,
  {
    code,
    constraintName,
  }: {
    code: postgres.PostgresError["code"];
    constraintName: NonNullable<postgres.PostgresError["constraint_name"]>;
  },
): boolean => {
  const postgresError = findPostgresError(error);
  if (!postgresError) return false;

  return postgresError.code === code && postgresError.constraint_name === constraintName;
};

export const isPostgresUniqueViolation = (error: unknown, constraintName: string): boolean => {
  return isPostgresConstraintViolation(error, { code: UNIQUE_VIOLATION, constraintName });
};

export const isPostgresCheckViolation = (error: unknown, constraintName: string): boolean => {
  return isPostgresConstraintViolation(error, { code: CHECK_VIOLATION, constraintName });
};

export const isPostgresForeignKeyViolation = (error: unknown): boolean => {
  const postgresError = findPostgresError(error);
  if (!postgresError) return false;
  return postgresError.code === FOREIGN_KEY_VIOLATION;
};

export const isPostgresNotNullViolation = (error: unknown): boolean => {
  const postgresError = findPostgresError(error);
  if (!postgresError) return false;
  return postgresError.code === NOT_NULL_VIOLATION;
};

/**
 * PostgresError のコードから適切な DbError へのマッピングを行う。
 * 認識不能なコードや非 PostgresError の場合は null を返す。
 */
export const mapPostgresToDbError = (error: unknown, fallbackMessage: string): DbError | null => {
  const postgresError = findPostgresError(error);
  if (!postgresError) return null;

  const statusCode = CODE_TO_STATUS[postgresError.code];
  if (!statusCode) return null;

  return new DbError({
    message: fallbackMessage,
    statusCode,
    cause: error,
  });
};

/**
 * DB 境界で受け取った未知のエラーを、アプリで扱う DbError に正規化する。
 * Postgres の制約違反は SQLSTATE から 400/409 にし、未知のエラーは 500 にする。
 */
export const toDbError = (
  error: unknown,
  fallbackMessage: string,
  options: ToDbErrorOptions = {},
): DbError => {
  if (error instanceof DbError) return error;

  const postgresError = findPostgresError(error);
  const constraintName = postgresError?.constraint_name;
  const constraint = constraintName ? findPostgresConstraint(constraintName) : undefined;
  const mappedConstraint =
    constraint && options.constraints?.includes(constraint.constraintName as PostgresConstraintName)
      ? constraint
      : undefined;

  if (postgresError && mappedConstraint) {
    return new DbError({
      message: mappedConstraint.message,
      statusCode:
        mappedConstraint.statusCode ??
        CODE_TO_STATUS[postgresError.code] ??
        (500 as ErrorStatusCode),
      typeUri: mappedConstraint.errorSlug
        ? getProblemTypeUri(mappedConstraint.errorSlug)
        : undefined,
      cause: error,
    });
  }

  const mapped = mapPostgresToDbError(error, fallbackMessage);
  if (mapped) return mapped;

  return new DbError({
    message: fallbackMessage,
    cause: error,
  });
};
