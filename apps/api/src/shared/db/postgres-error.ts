import { DrizzleQueryError } from "drizzle-orm/errors";
import postgres from "postgres";

const UNIQUE_VIOLATION = "23505";

export const isPostgresUniqueViolation = (error: unknown, constraintName: string): boolean => {
  if (
    error instanceof postgres.PostgresError &&
    error.code === UNIQUE_VIOLATION &&
    error.constraint_name === constraintName
  ) {
    return true;
  }

  if (error instanceof DrizzleQueryError) {
    return isPostgresUniqueViolation(error.cause, constraintName);
  }

  return false;
};
