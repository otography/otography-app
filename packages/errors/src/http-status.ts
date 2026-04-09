import type { ContentfulStatusCode, SuccessStatusCode } from "hono/utils/http-status";

/** エラーレスポンスのステータスコード。2xx（成功）は含まない。 */
export type ErrorStatusCode = Exclude<ContentfulStatusCode, SuccessStatusCode>;
