import { createTaggedError } from "errore";

export class RateLimitCheckError extends createTaggedError({
  name: "RateLimitCheckError",
  message: "回数制限 $limiter を確かめられませんでした",
}) {}
