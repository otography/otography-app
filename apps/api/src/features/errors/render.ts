import type { ErrorStatusCode } from "@repo/errors";

/**
 * findProblemType が返すエントリのうち、ドキュメント描画に必要な部分。
 */
type ErrorDocEntry = {
  typeUri: string;
  title: string;
  description: string;
  statusCode: ErrorStatusCode;
};

type ErrorDocJson = {
  type: string;
  title: string;
  status: ErrorStatusCode;
  description: string;
};

/**
 * HTML への埋め込み時に XSS を防ぐための簡易エスケープ。
 * title/description はコード内固定値だが、念のため適用する。
 */
const escapeHtml = (value: string): string => {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
};

/**
 * エラー型ドキュメントの JSON レスポンスボディを生成する。
 */
export const renderErrorDocJson = (entry: ErrorDocEntry): ErrorDocJson => {
  return {
    type: entry.typeUri,
    title: entry.title,
    status: entry.statusCode,
    description: entry.description,
  };
};

/**
 * エラー型ドキュメントの HTML レスポンスを生成する。
 */
export const renderErrorDocHtml = (entry: ErrorDocEntry): string => {
  const title = escapeHtml(entry.title);
  const description = escapeHtml(entry.description);
  const typeUri = escapeHtml(entry.typeUri);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>body{font-family:sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#333}h1{color:#c00}pre{background:#f5f5f5;padding:1rem;border-radius:4px;overflow-x:auto}</style>
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <pre>{
  "type": "${typeUri}",
  "title": "${title}",
  "status": ${entry.statusCode}
}</pre>
</body>
</html>`;
};
