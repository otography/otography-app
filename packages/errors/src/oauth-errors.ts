import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as errore from "errore";

class OAuthConfigError extends errore.createTaggedError({
  name: "OAuthConfigError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 500;
}

class OAuthStateError extends errore.createTaggedError({
  name: "OAuthStateError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 400;
}

class OAuthExchangeError extends errore.createTaggedError({
  name: "OAuthExchangeError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 502;
}

export { OAuthConfigError, OAuthStateError, OAuthExchangeError };
