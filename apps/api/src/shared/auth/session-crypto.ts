// オペークセッションIDの生成とハッシュ化ユーティリティ

// 32バイトのベース64urlエンコードは43文字（パディングなし）
// これがオペークCookie値の唯一の正しい形式
const OPAQUE_ID_REGEX = /^[A-Za-z0-9_-]{43}$/;

/** 256ビット（32バイト）のランダムエントロピーでオペークセッションIDを生成する */
export const generateOpaqueSessionId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64urlEncode(bytes);
};

/** セッションIDの raw 値を SHA-256 でハッシュ化し hex 文字列として返す */
export const hashSessionId = async (rawId: string): Promise<string> => {
  const encoded = new TextEncoder().encode(rawId);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * オペークCookie値の構文を検証する。
 * 生成されたIDと完全に一致する形式（32バイトのbase64url = 43文字）のみを受け入れる。
 * 不正な値はDBルックアップ前に拒否し、Cookieをクリアする。
 */
export const isValidOpaqueCookieValue = (value: string): boolean => OPAQUE_ID_REGEX.test(value);

// base64url エンコード（パディングなし）
const base64urlEncode = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
