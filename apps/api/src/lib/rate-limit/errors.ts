import * as errore from "errore";

export class RateLimitCheckError extends errore.createTaggedError({
  name: "RateLimitCheckError",
  message: "回数制限 $limiter を確かめられませんでした",
}) {}
