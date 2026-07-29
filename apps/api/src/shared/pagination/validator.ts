import { arktypeValidator } from "@hono/arktype-validator";
import { badRequestResponse } from "../errors/error-response";
import { paginationQuerySchema } from "./schema";

/** ページネーションクエリの共通バリデータ（不正時は 400 Problem Details） */
export const paginationQueryValidator = arktypeValidator(
  "query",
  paginationQuerySchema,
  (result, c) => {
    if (!result.success) {
      return badRequestResponse(c, "Please provide valid pagination parameters.");
    }
  },
);
