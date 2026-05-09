import type { ErrorStatusCode } from "./http-status";
import * as errore from "errore";

class AuthRestError extends errore.createTaggedError({
  name: "AuthRestError",
  message: "$message",
}) {
  readonly statusCode: ErrorStatusCode;
  readonly typeUri?: string;

  constructor(args: {
    message: string;
    statusCode: ErrorStatusCode;
    typeUri?: string;
    cause?: unknown;
  }) {
    super(args);
    this.statusCode = args.statusCode;
    this.typeUri = args.typeUri;
  }
}

export { AuthRestError };
