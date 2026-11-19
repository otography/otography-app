/**
 * ベクトルとバイト列の変換。D1 と Turso の BLOB に入れるときに使う。
 */

/** number を IEEE 754 半精度（16bit）にする。丸めは最近接偶数。 */
const toHalf = (value: number) => {
  const f32 = new Float32Array([value]);
  const bits = new Uint32Array(f32.buffer)[0] ?? 0;
  const sign = (bits >>> 16) & 0x8000;
  const exponent = (bits >>> 23) & 0xff;
  const mantissa = bits & 0x7fffff;
  if (exponent === 0xff) return sign | 0x7c00 | (mantissa ? 0x200 : 0);
  const e = exponent - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    const m = (mantissa | 0x800000) >> (1 - e);
    return sign | ((m + 0x1000 + ((m >> 13) & 1) - 1) >> 13);
  }
  const rounded = mantissa + 0xfff + ((mantissa >> 13) & 1);
  if (rounded & 0x800000) return sign | (Math.min(e + 1, 0x1f) << 10);
  return sign | (e << 10) | (rounded >> 13);
};

const fromHalf = (h: number) => {
  const sign = h & 0x8000 ? -1 : 1;
  const exponent = (h >> 10) & 0x1f;
  const fraction = h & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
};

/** ベクトルを半精度のバイト列（リトルエンディアン、2 バイト × 次元数）にする。 */
export function encodeHalf(vector: ArrayLike<number>) {
  const bytes = new Uint8Array(vector.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < vector.length; i++) view.setUint16(i * 2, toHalf(vector[i] ?? 0), true);
  return bytes;
}

/** encodeHalf の逆。 */
export function decodeHalf(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Float32Array.from({ length: Math.floor(bytes.byteLength / 2) }, (_, i) =>
    fromHalf(view.getUint16(i * 2, true)),
  );
}

/** Float32Array をバイト列にする（コピーしない）。 */
export const float32Bytes = (vector: Float32Array) =>
  new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);

/** バイト列を Float32Array にする。byteOffset が 4 の倍数とは限らないので、コピーしてから読む。 */
export const bytesToFloat32 = (bytes: Uint8Array) => new Float32Array(new Uint8Array(bytes).buffer);

export const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export const fromHex = (hex: string) =>
  Uint8Array.from({ length: hex.length / 2 }, (_, i) =>
    Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16),
  );
