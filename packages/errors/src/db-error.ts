import type { ErrorStatusCode } from "./http-status";
import * as errore from "errore";

class DbError extends errore.createTaggedError({
  name: "DbError",
  message: "$message",
}) {
  readonly statusCode: ErrorStatusCode;

  constructor(args: { message: string; statusCode?: ErrorStatusCode; cause?: unknown }) {
    super(args);
    this.statusCode = args.statusCode ?? 500;
  }
}

export { DbError };
