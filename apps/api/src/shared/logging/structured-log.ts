import { errorLogFields } from "./redaction";

/**
 * エラーを構造化 JSON としてログ出力する
 * console.error で JSON.stringify({ timestamp, path, ...errorLogFields(error) }) を出力
 */
export const logError = (error: unknown, path: string): void => {
  if (error instanceof Error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        path,
        ...errorLogFields(error),
      }),
    );
  } else {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        path,
        error: error === null ? "null" : String(error),
      }),
    );
  }
};
