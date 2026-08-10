// hex エンコード/デコードの共通ユーティリティ（envelope / key-ring-loader / session-crypto で共有）

// Uint8Array → hex 文字列
export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

// hex 文字列 → Uint8Array（厳格な入力検証は呼び出し側の責務）
export const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
};
