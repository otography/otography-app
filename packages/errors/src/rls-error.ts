import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as errore from "errore";

class RlsError extends errore.createTaggedError({
  name: "RlsError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 500;

  constructor(args: { message: string; cause?: unknown }) {
    super(args);
  }
}

export { RlsError };
