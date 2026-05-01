import * as errore from "errore";

export class RefreshTokenCookieError extends errore.createTaggedError({
  name: "RefreshTokenCookieError",
  message: "$message",
}) {}
