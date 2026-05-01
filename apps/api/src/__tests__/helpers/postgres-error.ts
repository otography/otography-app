import { DrizzleQueryError } from "drizzle-orm/errors";
import postgres from "postgres";

export const createPostgresError = ({
  code = "23505",
  constraintName,
  message = "postgres constraint violation",
}: {
  code?: string;
  constraintName: string;
  message?: string;
}) => {
  const error = new Error(message) as postgres.PostgresError;
  Object.setPrototypeOf(error, postgres.PostgresError.prototype);

  return Object.assign(error, {
    name: "PostgresError" as const,
    severity_local: "ERROR",
    severity: "ERROR",
    code,
    position: "",
    file: "",
    line: "",
    routine: "",
    constraint_name: constraintName,
    query: "",
    parameters: [],
  });
};

export const createDrizzleConstraintError = ({
  code = "23505",
  constraintName,
  query = "insert into table",
}: {
  code?: string;
  constraintName: string;
  query?: string;
}) =>
  new DrizzleQueryError(
    query,
    [],
    createPostgresError({
      code,
      constraintName,
      message: "constraint violation",
    }),
  );
