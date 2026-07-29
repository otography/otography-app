import type { ErrorStatusCode } from "./http-status";
import type { ProblemSlug } from "./problem-slug";
import * as errore from "errore";

class AppleMusicError extends errore.createTaggedError({
  name: "AppleMusicError",
  message: "$message",
}) {
  readonly statusCode: ErrorStatusCode;
  readonly problemSlug?: ProblemSlug;

  constructor(args: {
    message: string;
    statusCode?: ErrorStatusCode;
    problemSlug?: ProblemSlug;
    cause?: unknown;
  }) {
    super(args);
    this.statusCode = args.statusCode ?? 502;
    this.problemSlug = args.problemSlug;
  }
}

export { AppleMusicError };
