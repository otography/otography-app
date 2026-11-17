import { DrizzleQueryError } from "drizzle-orm";

/** たどる原因の深さの上限（循環した cause で止まらなくならないように）。 */
const MAX_DEPTH = 8;

/** ログに出すエラーの形。cause を順にたどった結果を入れる。 */
type LoggedError = { name: string; message: string; stack?: string; cause?: LoggedError | string };

/**
 * エラーを、ログに出してよい形にする。
 * DrizzleQueryError は文言に SQL の値（IP アドレス、メールアドレスなど）を含むので、値を取り除き、SQL だけを残す。
 * スタックトレースの先頭にも文言が入るので、同じように置き換える。
 * errore のエラーは、スタックトレースの後ろに原因のスタックトレース（Caused by: …）を付ける。
 * 原因は cause として別に出すので、その部分は切り捨てる（そこに値が残るため）。
 */
export function redactError(error: unknown, depth = 0): LoggedError | string {
  if (!(error instanceof Error)) return String(error);
  const message =
    error instanceof DrizzleQueryError ? `Failed query: ${error.query}` : error.message;
  return {
    name: error.name,
    message,
    stack: error.stack?.split("\nCaused by:")[0]?.replace(error.message, message),
    cause:
      error.cause === undefined || depth >= MAX_DEPTH
        ? undefined
        : redactError(error.cause, depth + 1),
  };
}

/** 想定外のエラーを、SQL の値を取り除いてからログに出す。 */
export const logError = (error: unknown) => console.error(redactError(error));

/** 処理を続けられる失敗を、SQL の値を取り除いてからログに出す。 */
export const logWarning = (message: string, error: unknown) =>
  console.warn(message, redactError(error));
