import type { ErrorStatusCode } from "./http-status";
import * as errore from "errore";

class DbError extends errore.createTaggedError({
  name: "DbError",
  message: "$message",
}) {
  readonly statusCode: ErrorStatusCode;
  readonly typeUri?: string;

  constructor(args: {
    message: string;
    statusCode?: ErrorStatusCode;
    typeUri?: string;
    cause?: unknown;
  }) {
    super(args);
    this.statusCode = args.statusCode ?? 500;
    this.typeUri = args.typeUri;
  }
}

export { DbError };
