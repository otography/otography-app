import * as errore from "errore";

export class WebAuthClientError extends errore.createTaggedError({
  name: "WebAuthClientError",
  message: "$message",
}) {}
