import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as errore from "errore";

class RlsError extends errore.createTaggedError({
  name: "RlsError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 500;
  readonly typeUri?: string;

  constructor(args: { message: string; typeUri?: string; cause?: unknown }) {
    super(args);
    this.typeUri = args.typeUri;
  }
}

export { RlsError };
