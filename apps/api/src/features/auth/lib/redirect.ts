// オープンリダイレクト防止: 相対パス（"/"始まり、"//"始まりでない）のみ許可するヘルパー。
// redirectパラメータ検証・state検証・最終リダイレクト構築の3箇所で重複していたロジックを共通化。

// パスが相対パスとして安全かどうかを判定する
export const isSafeRedirectPath = (path: string | undefined): path is string =>
  typeof path === "string" && path.startsWith("/") && !path.startsWith("//");

// 安全な相対パスならそのまま返し、そうでなければfallbackを返す
export const safeRedirectPath = (path: string | undefined, fallback: string): string =>
  isSafeRedirectPath(path) ? path : fallback;
