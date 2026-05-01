import { DrizzleQueryError } from "drizzle-orm/errors";
import postgres from "postgres";

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

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
