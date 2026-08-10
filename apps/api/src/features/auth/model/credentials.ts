import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { badRequestResponse } from "../../../shared/errors/error-response";

// email/passwordサインイン・サインアップ共通のリクエストボディスキーマ
const credentialsBodySchema = type({
  email: type.pipe(type("string.trim"), type("string.lower"), type("string.email")),
  password: "string >= 6",
});

export const credentialsValidator = arktypeValidator("json", credentialsBodySchema, (result, c) => {
  if (!result.success) {
    return badRequestResponse(
      c,
      "Please provide a valid email address and a password with at least 6 characters.",
    );
  }
});
