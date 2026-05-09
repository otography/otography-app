import { DbError, type ErrorStatusCode } from "@repo/errors";
import { AuthError } from "@repo/errors/server";
import { getProblemType } from "./error-registry";
import type { ErrorSlug } from "./error-registry";

type DomainDbErrorInput = {
  slug: ErrorSlug;
  message: string;
  cause?: unknown;
};

type DomainAuthErrorInput = DomainDbErrorInput & {
  code: string;
};

const resolveDomainProblem = (slug: ErrorSlug) => {
  return getProblemType(slug);
};

export const domainDbError = ({ slug, message, cause }: DomainDbErrorInput) => {
  const problem = resolveDomainProblem(slug);
  return new DbError({
    message,
    statusCode: problem.statusCode,
    typeUri: problem.typeUri,
    cause,
  });
};

export const domainAuthError = ({ slug, message, code, cause }: DomainAuthErrorInput) => {
  const problem = resolveDomainProblem(slug);
  return new AuthError({
    message,
    code,
    statusCode: problem.statusCode as ErrorStatusCode,
    typeUri: problem.typeUri,
    cause,
  });
};
