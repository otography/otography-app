import type { ErrorStatusCode } from "./http-status";
import type { ProblemSlug } from "./problem-slug";
import * as errore from "errore";

class AuthRestError extends errore.createTaggedError({
  name: "AuthRestError",
  message: "$message",
}) {
  readonly statusCode: ErrorStatusCode;
  readonly problemSlug?: ProblemSlug;

  constructor(args: {
    message: string;
    statusCode: ErrorStatusCode;
    problemSlug?: ProblemSlug;
    cause?: unknown;
  }) {
    super(args);
    this.statusCode = args.statusCode;
    this.problemSlug = args.problemSlug;
  }
}

export { AuthRestError };
