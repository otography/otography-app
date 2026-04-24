import type { ErrorStatusCode } from "./http-status";
import * as errore from "errore";

class DbError extends errore.createTaggedError({
  name: "DbError",
  message: "$message",
}) {
  readonly statusCode: ErrorStatusCode = 500;

  constructor(args: { message: string; statusCode?: ErrorStatusCode; cause?: unknown }) {
    super(args);
    if (args.statusCode !== undefined) this.statusCode = args.statusCode;
  }
}

export { DbError };
