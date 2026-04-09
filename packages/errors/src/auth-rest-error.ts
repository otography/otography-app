import type { ErrorStatusCode } from "./http-status";
import * as errore from "errore";

class AuthRestError extends errore.createTaggedError({
  name: "AuthRestError",
  message: "$message",
}) {
  readonly statusCode: ErrorStatusCode;

  constructor(args: { message: string; statusCode: ErrorStatusCode; cause?: unknown }) {
    super(args);
    this.statusCode = args.statusCode;
  }
}

export { AuthRestError };
