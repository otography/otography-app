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

class AppleMusicRateLimitError extends errore.createTaggedError({
  name: "AppleMusicRateLimitError",
  message: "Apple Music API のレート制限中です。しばらく待ってから再試行してください。",
}) {
  readonly statusCode: ErrorStatusCode = 503;
  readonly retryAfter: string | null;

  constructor(args: { retryAfter: string | null; cause?: unknown }) {
    super(args);
    this.retryAfter = args.retryAfter;
  }
}

export { AppleMusicError, AppleMusicRateLimitError };
